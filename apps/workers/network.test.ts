import { describe, expect, test, vi } from "vitest";

vi.mock("@karakeep/shared/config", () => ({
  default: {
    allowedInternalHostnames: undefined,
    crawler: { ipValidation: { dnsResolverTimeoutSec: 1 } },
    proxy: {
      httpProxy: undefined,
      httpsProxy: undefined,
      noProxy: undefined,
    },
  },
}));

import { createPinnedLookup, validateUrl } from "./network";

describe("createPinnedLookup", () => {
  test("returns a previously validated address without another DNS lookup", async () => {
    const lookup = createPinnedLookup([
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]);

    const result = await new Promise<{ address: string; family: number }>(
      (resolve, reject) => {
        lookup("rebind.example", {}, (error, address, family) => {
          if (error) {
            reject(error);
          } else if (typeof address !== "string" || family === undefined) {
            reject(new Error("Expected a single lookup result"));
          } else {
            resolve({ address, family });
          }
        });
      },
    );

    expect(result).toEqual({ address: "93.184.216.34", family: 4 });
  });

  test("honors the socket's requested address family", async () => {
    const lookup = createPinnedLookup([
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]);

    const result = await new Promise<{ address: string; family: number }>(
      (resolve, reject) => {
        lookup("rebind.example", { family: 6 }, (error, address, family) => {
          if (error) {
            reject(error);
          } else if (typeof address !== "string" || family === undefined) {
            reject(new Error("Expected a single lookup result"));
          } else {
            resolve({ address, family });
          }
        });
      },
    );

    expect(result).toEqual({
      address: "2606:2800:220:1:248:1893:25c8:1946",
      family: 6,
    });
  });

  test("returns all validated addresses when requested by the socket", async () => {
    const lookup = createPinnedLookup([
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]);

    const result = await new Promise<{ address: string; family: number }[]>(
      (resolve, reject) => {
        lookup("rebind.example", { all: true }, (error, addresses) => {
          if (error) {
            reject(error);
          } else if (typeof addresses === "string") {
            reject(new Error("Expected all lookup results"));
          } else {
            resolve(addresses);
          }
        });
      },
    );

    expect(result).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
  });

  test("refuses to return a forbidden address", async () => {
    const lookup = createPinnedLookup(["127.0.0.1", "169.254.169.254"]);

    const error = await new Promise<NodeJS.ErrnoException>(
      (resolve, reject) => {
        lookup("rebind.example", {}, (lookupError) => {
          if (lookupError) {
            resolve(lookupError);
          } else {
            reject(
              new Error("Expected the lookup to reject forbidden addresses"),
            );
          }
        });
      },
    );

    expect(error.code).toBe("ENOTFOUND");
  });

  test("never selects a forbidden address from a mixed result set", async () => {
    const lookup = createPinnedLookup(["127.0.0.1", "93.184.216.34"]);

    const result = await new Promise<{ address: string; family: number }>(
      (resolve, reject) => {
        lookup("rebind.example", {}, (error, address, family) => {
          if (error) {
            reject(error);
          } else if (typeof address !== "string" || family === undefined) {
            reject(new Error("Expected a single lookup result"));
          } else {
            resolve({ address, family });
          }
        });
      },
    );

    expect(result).toEqual({ address: "93.184.216.34", family: 4 });
  });
});

// Redirect chains from link shorteners are followed hop by hop and the result is
// persisted onto the bookmark, so this gate is what keeps an attacker-controlled
// redirect from pointing the crawler at the internal network.
describe("validateUrl", () => {
  test.each([
    ["loopback", "http://127.0.0.1/admin"],
    ["IPv6 loopback", "http://[::1]/admin"],
    ["IPv4-mapped IPv6 loopback", "http://[::ffff:127.0.0.1]/admin"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["private range", "http://10.0.0.1/"],
    ["private range", "http://192.168.1.1/"],
    ["carrier-grade NAT", "http://100.64.0.1/"],
    ["unique local IPv6", "http://[fd00::1]/"],
  ])("rejects %s addresses", async (_label, url) => {
    const result = await validateUrl(url, false);
    expect(result.ok).toBe(false);
  });

  test.each([
    ["file", "file:///etc/passwd"],
    ["gopher", "gopher://example.com/"],
    ["ftp", "ftp://example.com/"],
  ])("rejects the %s scheme", async (_label, url) => {
    const result = await validateUrl(url, false);
    expect(result.ok).toBe(false);
  });

  test("allows a public literal address without a DNS lookup", async () => {
    const result = await validateUrl("https://93.184.216.34/page", false);
    expect(result.ok).toBe(true);
  });
});
