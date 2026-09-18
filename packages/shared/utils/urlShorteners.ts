/**
 * Link shorteners whose URLs carry no information beyond the redirect target.
 * Bookmarks pointing at these hosts get rewritten to the final destination by
 * the crawler so that search, dedup and the UI all see the real URL.
 */
const KNOWN_URL_SHORTENERS: readonly string[] = [
  "amzn.to",
  "bit.ly",
  "bitly.com",
  "buff.ly",
  "cutt.ly",
  "dlvr.it",
  "fb.me",
  "flip.it",
  "goo.gl",
  "ift.tt",
  "is.gd",
  "j.mp",
  "lnkd.in",
  "ow.ly",
  "rb.gy",
  "rebrand.ly",
  "shorturl.at",
  "t.co",
  "t.ly",
  "tiny.cc",
  "tinyurl.com",
  "trib.al",
  "v.gd",
  "wp.me",
  "youtu.be",
];

/**
 * Hosts are matched exactly (case-insensitively, modulo a leading "www."), and
 * never by suffix: a suffix match would treat attacker-controlled hosts like
 * "bit.ly.example.com" as a shortener and hand them a URL rewrite.
 */
function normalizeShortenerHostname(hostname: string): string {
  const lowered = hostname.toLowerCase();
  return lowered.startsWith("www.") ? lowered.slice(4) : lowered;
}

export function buildShortenerSet(
  extraShorteners: readonly string[] = [],
): ReadonlySet<string> {
  return new Set(
    [...KNOWN_URL_SHORTENERS, ...extraShorteners]
      .map((host) => normalizeShortenerHostname(host.trim()))
      .filter((host) => host.length > 0),
  );
}

export function isKnownShortener(
  url: string,
  shorteners: ReadonlySet<string>,
): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return shorteners.has(normalizeShortenerHostname(hostname));
}
