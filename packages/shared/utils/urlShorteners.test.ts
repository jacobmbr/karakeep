import { describe, expect, it } from "vitest";

import { buildShortenerSet, isKnownShortener } from "./urlShorteners";

const shorteners = buildShortenerSet();

describe("isKnownShortener", () => {
  it("matches known shortener hosts", () => {
    expect(isKnownShortener("https://t.co/abc123", shorteners)).toBe(true);
    expect(isKnownShortener("https://bit.ly/xyz", shorteners)).toBe(true);
    expect(isKnownShortener("https://tinyurl.com/foo", shorteners)).toBe(true);
  });

  it("ignores case and a leading www.", () => {
    expect(isKnownShortener("https://BIT.LY/xyz", shorteners)).toBe(true);
    expect(isKnownShortener("https://www.bit.ly/xyz", shorteners)).toBe(true);
  });

  it("does not match hosts that merely end with a shortener name", () => {
    expect(isKnownShortener("https://bit.ly.example.com/xyz", shorteners)).toBe(
      false,
    );
    expect(isKnownShortener("https://nott.co/abc", shorteners)).toBe(false);
    expect(isKnownShortener("https://evil.com/t.co/abc", shorteners)).toBe(
      false,
    );
  });

  it("does not match subdomains of a shortener", () => {
    expect(isKnownShortener("https://a.bit.ly/xyz", shorteners)).toBe(false);
  });

  it("leaves ordinary URLs alone", () => {
    expect(isKnownShortener("https://example.com/article", shorteners)).toBe(
      false,
    );
  });

  it("returns false for unparseable URLs", () => {
    expect(isKnownShortener("not a url", shorteners)).toBe(false);
    expect(isKnownShortener("", shorteners)).toBe(false);
  });

  it("honours extra configured shorteners", () => {
    const withExtra = buildShortenerSet(["go.internal", " Link.Corp "]);
    expect(isKnownShortener("https://go.internal/x", withExtra)).toBe(true);
    expect(isKnownShortener("https://link.corp/x", withExtra)).toBe(true);
    expect(isKnownShortener("https://go.internal.evil.com/x", withExtra)).toBe(
      false,
    );
  });
});
