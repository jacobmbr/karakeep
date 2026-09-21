# Entry point for plain `nix-shell` — no flakes, no unified `nix` command.
#
#   nix-shell            # drops you in the dev shell
#   nix-shell --run CMD  # runs one command in it
#
# Some installs only expose the classic commands (nix-build, nix-shell,
# nix-env, ...). This hands those the *same* devShell flake.nix defines, via
# flake-compat, rather than restating the package list here where it would
# drift. nixpkgs still comes from flake.lock, so both entry points resolve to
# the same toolchain.
#
# Note the Linux default is an FHS sandbox that re-execs into its own bash, so
# `nix-shell --run CMD` skips the profile the same way `nix develop -c` does.
# For scripting, ask for the non-FHS shell instead:
#
#   nix-shell --argstr shell native --run CMD
#
# which needs nix-ld on the host for prebuilt npm binaries to run.
{ shell ? "default" }:
let
  flakeCompat = builtins.fetchTarball {
    url = "https://github.com/edolstra/flake-compat/archive/5edf11c44bc78a0d334f6334cdaf7d60d732daab.tar.gz";
    sha256 = "0yqfa6rx8md81bcn4szfp0hjq2f3h9i8zjzhqqyfqdkrj5559nmw";
  };

  flake = import flakeCompat { src = ./.; };
  system = builtins.currentSystem;
in
flake.defaultNix.devShells.${system}.${shell}
