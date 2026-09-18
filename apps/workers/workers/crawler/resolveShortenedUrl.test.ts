import { beforeEach, describe, expect, test, vi } from "vitest";

const resolveValidatedRedirectUrl = vi.fn();

vi.mock("network", () => ({
  resolveValidatedRedirectUrl: (...args: unknown[]) =>
    resolveValidatedRedirectUrl(...args),
}));

vi.mock("@karakeep/shared/config", () => ({
  default: {
    crawler: {
      resolveShortenedUrls: true,
      extraUrlShorteners: ["go.internal"],
    },
  },
}));

vi.mock("@karakeep/shared/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { isShortenedUrl, resolveShortenedUrl } from "./resolveShortenedUrl";

const runProxy = {
  httpProxy: undefined,
  httpsProxy: undefined,
  noProxy: undefined,
};

function resolve(url: string) {
  return resolveShortenedUrl(
    url,
    "job-1",
    new AbortController().signal,
    runProxy,
  );
}

beforeEach(() => {
  resolveValidatedRedirectUrl.mockReset();
});

describe("isShortenedUrl", () => {
  test("recognises built-in and configured shorteners", () => {
    expect(isShortenedUrl("https://t.co/abc")).toBe(true);
    expect(isShortenedUrl("https://go.internal/abc")).toBe(true);
    expect(isShortenedUrl("https://example.com/abc")).toBe(false);
  });
});

describe("resolveShortenedUrl", () => {
  test("returns the destination the redirect chain lands on", async () => {
    resolveValidatedRedirectUrl.mockResolvedValue(
      new URL("https://example.com/real-article?utm=1"),
    );

    await expect(resolve("https://t.co/abc")).resolves.toBe(
      "https://example.com/real-article?utm=1",
    );
  });

  test("strips credentials the destination carries", async () => {
    resolveValidatedRedirectUrl.mockResolvedValue(
      new URL("https://user:hunter2@example.com/page"),
    );

    await expect(resolve("https://t.co/abc")).resolves.toBe(
      "https://example.com/page",
    );
  });

  test("keeps the original URL when the chain is rejected as unsafe", async () => {
    resolveValidatedRedirectUrl.mockRejectedValue(
      new Error("Refusing to access disallowed resolved address 127.0.0.1"),
    );

    await expect(resolve("https://t.co/abc")).resolves.toBe("https://t.co/abc");
  });

  test("keeps the original URL when the chain times out", async () => {
    resolveValidatedRedirectUrl.mockRejectedValue(
      new Error("The operation was aborted due to timeout"),
    );

    await expect(resolve("https://t.co/abc")).resolves.toBe("https://t.co/abc");
  });

  test("keeps the original URL when the chain exceeds the redirect cap", async () => {
    resolveValidatedRedirectUrl.mockRejectedValue(
      new Error("Too many redirects while resolving https://t.co/abc"),
    );

    await expect(resolve("https://t.co/abc")).resolves.toBe("https://t.co/abc");
  });

  test("refuses to rewrite to a non-http(s) destination", async () => {
    resolveValidatedRedirectUrl.mockResolvedValue(
      new URL("file:///etc/passwd"),
    );

    await expect(resolve("https://t.co/abc")).resolves.toBe("https://t.co/abc");
  });
});
