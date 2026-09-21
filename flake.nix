{
  description = "Karakeep development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      mkEnv =
        pkgs:
        let
          inherit (pkgs) lib;

          # Node toolchain. `.nvmrc` pins 24; `packageManager` pins pnpm 11.2.1.
          # nixpkgs' pnpm is 11.x, and pnpm self-manages the exact version from
          # `packageManager` into $PNPM_HOME, so we land on 11.2.1 without
          # corepack (whose bundled signature keys are too old for recent pnpm
          # releases -- see the `npm i -g corepack@latest` in docker/Dockerfile).
          nodeTools = [
            pkgs.nodejs_24
            pkgs.pnpm
          ];

          # node-gyp needs these to build better-sqlite3 / re2 / sharp from source.
          buildTools = [
            pkgs.python3
            pkgs.gnumake
            pkgs.pkg-config
          ];

          # External binaries the crawler and asset workers shell out to.
          # Mirrors the runtime deps installed in docker/Dockerfile.
          crawlerTools = [
            pkgs.monolith # full-page HTML archiving
            pkgs.yt-dlp # CRAWLER_VIDEO_DOWNLOAD
            pkgs.ffmpeg # yt-dlp muxing
            pkgs.graphicsmagick # image asset processing
            pkgs.ghostscript # PDF rendering
          ];

          devTools = [
            pkgs.git
            pkgs.jq
            pkgs.sqlite
          ];

          # Meilisearch, natively -- no docker needed for the search backend.
          meiliScript = pkgs.writeShellScriptBin "karakeep-meili" ''
            dir="''${KARAKEEP_MEILI_DIR:-$PWD/.nix/meili}"
            mkdir -p "$dir"
            exec ${pkgs.meilisearch}/bin/meilisearch \
              --db-path "$dir/data.ms" \
              --dump-dir "$dir/dumps" \
              --no-analytics \
              --http-addr 127.0.0.1:7700 "$@"
          '';

          # The crawler only ever connects over CDP (see
          # apps/workers/workers/crawler/browser.ts), so any chrome exposing
          # :9222 works. Upstream's image carries the flags they test against.
          chromeScript = pkgs.writeShellScriptBin "karakeep-chrome" ''
            if ! command -v docker >/dev/null 2>&1; then
              echo "docker not found. Alternatively run any chromium with" >&2
              echo "  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1" >&2
              exit 1
            fi
            if docker ps -a --format '{{.Names}}' | grep -qx karakeep-chrome; then
              exec docker start -a karakeep-chrome
            fi
            exec docker run --rm --init \
              -p 127.0.0.1:9222:9222 \
              --name karakeep-chrome \
              ghcr.io/karakeep-app/karakeep-chrome:release \
              --disable-gpu \
              --disable-dev-shm-usage \
              --hide-scrollbars \
              --disable-blink-features=AutomationControlled \
              --window-size=1440,900
          '';

          packages =
            nodeTools
            ++ buildTools
            ++ crawlerTools
            ++ devTools
            ++ [
              pkgs.meilisearch
              meiliScript
              chromeScript
            ];

          # Shared runtime env + first-run bootstrap. Used verbatim as the FHS
          # `profile` and as the plain shell's `shellHook`.
          profile = ''
            repoRoot="''${PWD}"
            while [ "$repoRoot" != "/" ] && [ ! -f "$repoRoot/pnpm-workspace.yaml" ]; do
              repoRoot="$(dirname "$repoRoot")"
            done
            if [ ! -f "$repoRoot/pnpm-workspace.yaml" ]; then
              repoRoot="''${PWD}"
            fi

            # Keep shell state inside the repo (gitignored) rather than $HOME.
            export PNPM_HOME="$repoRoot/.nix/pnpm"
            export npm_config_cache="$repoRoot/.nix/npm-cache"
            mkdir -p "$PNPM_HOME" "$npm_config_cache"
            export PATH="$PNPM_HOME:$repoRoot/node_modules/.bin:$PATH"

            # Local service endpoints, matching docker/docker-compose.dev.yml.
            export MEILI_ADDR="''${MEILI_ADDR:-http://127.0.0.1:7700}"
            export BROWSER_WEB_URL="''${BROWSER_WEB_URL:-http://127.0.0.1:9222}"
            export NEXTAUTH_URL="''${NEXTAUTH_URL:-http://localhost:3000}"

            # `.env` is gitignored; seed it once so `pnpm web` boots.
            if [ ! -f "$repoRoot/.env" ]; then
              echo "Creating $repoRoot/.env with development defaults..."
              {
                echo "DATA_DIR=$repoRoot/.nix/data"
                echo "NEXTAUTH_SECRET=$(head -c 32 /dev/urandom | base64)"
              } > "$repoRoot/.env"
            fi

            # `import "dotenv/config"` only reads `.env` from the *cwd*, so a
            # workspace script run from packages/db or apps/web never sees the
            # root file -- `pnpm db:migrate` would silently use ./db.db instead
            # of DATA_DIR. Export it into the environment, the way
            # docker/docker-compose.dev.yml does.
            set -a
            . "$repoRoot/.env"
            set +a
            mkdir -p "$DATA_DIR"

            if [ -t 1 ]; then
              echo "karakeep dev shell  |  node $(node --version)  pnpm $(pnpm --version)"
              echo "  pnpm install                 install workspace deps"
              echo "  karakeep-meili               start meilisearch on :7700"
              echo "  karakeep-chrome              start headless chrome on :9222 (docker)"
              echo "  pnpm db:migrate              apply migrations"
              echo "  pnpm web / pnpm workers      run the app"
            fi
          '';

          # Shared libraries the prebuilt npm binaries link against
          # (sharp/@img, @swc/core, next-swc, esbuild, playwright's chromium).
          libs = with pkgs; [
            stdenv.cc.cc.lib
            zlib
            openssl
            libuuid
            # Enough of the chromium closure for a playwright-downloaded browser.
            glib
            nss
            nspr
            dbus
            atk
            at-spi2-atk
            at-spi2-core
            cups
            libdrm
            expat
            libxkbcommon
            mesa
            pango
            cairo
            alsa-lib
            libx11
            libxcomposite
            libxdamage
            libxext
            libxfixes
            libxrandr
            libxcb
          ];

          # pnpm pulls prebuilt glibc binaries (esbuild, @swc/core, next-swc,
          # sharp, playwright's chromium) that cannot run against NixOS'
          # non-standard loader. A real /usr/lib runs them untouched, which
          # keeps us byte-identical to upstream's lockfile with no
          # node_modules patching.
          fhs = pkgs.buildFHSEnv {
            name = "karakeep-dev";
            targetPkgs = _: packages ++ libs ++ [ pkgs.cacert ];
            inherit profile;
            runScript = "bash";
          };
        in
        {
          inherit
            pkgs
            lib
            packages
            profile
            libs
            fhs
            ;
        };
    in
    {
      devShells = forAllSystems (
        pkgs:
        let
          env = mkEnv pkgs;
        in
        {
          # Interactive default. Note an FHS shell re-execs into its own bash,
          # so `nix develop -c CMD` and direnv's `use flake` skip it silently;
          # for scripts and CI use `nix run .#dev -- -c CMD` instead.
          default =
            if pkgs.stdenv.hostPlatform.isLinux then
              env.fhs.env
            else
              pkgs.mkShell {
                inherit (env) packages;
                shellHook = env.profile;
              };

          # No FHS layer, so `nix develop .#native -c CMD` and direnv work.
          # Prebuilt npm binaries only run here if the host has nix-ld
          # (NixOS: `programs.nix-ld.enable = true;`).
          native = pkgs.mkShell {
            inherit (env) packages;
            shellHook =
              env.profile
              + nixpkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
                export NIX_LD_LIBRARY_PATH="${nixpkgs.lib.makeLibraryPath env.libs}''${NIX_LD_LIBRARY_PATH:+:$NIX_LD_LIBRARY_PATH}"
              '';
          };
        }
      );

      # The FHS sandbox as a runnable wrapper, for non-interactive use:
      #   nix run .#dev -- -c "pnpm install && pnpm typecheck"
      packages = forAllSystems (
        pkgs:
        nixpkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          dev = (mkEnv pkgs).fhs;
          default = (mkEnv pkgs).fhs;
        }
      );

      apps = forAllSystems (
        pkgs:
        nixpkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux (
          let
            app = {
              type = "app";
              program = "${(mkEnv pkgs).fhs}/bin/karakeep-dev";
            };
          in
          {
            dev = app;
            default = app;
          }
        )
      );

      formatter = forAllSystems (pkgs: pkgs.nixfmt-tree);
    };
}
