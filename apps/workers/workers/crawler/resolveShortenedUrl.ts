import type { RunProxyConfig } from "network";
import { resolveValidatedRedirectUrl } from "network";

import serverConfig from "@karakeep/shared/config";
import logger from "@karakeep/shared/logger";
import { isAllowedBookmarkUrl } from "@karakeep/shared/utils/url";
import {
  buildShortenerSet,
  isKnownShortener,
} from "@karakeep/shared/utils/urlShorteners";

import { truncateUrl } from "./utils";

const shorteners = buildShortenerSet(serverConfig.crawler.extraUrlShorteners);

export function isShortenedUrl(url: string): boolean {
  return (
    serverConfig.crawler.resolveShortenedUrls &&
    isKnownShortener(url, shorteners)
  );
}

/**
 * Follows a shortener's redirect chain and returns the destination it lands on,
 * or the original URL if the chain can't be resolved.
 *
 * Every hop is revalidated against the SSRF rules by
 * `resolveValidatedRedirectUrl`, so the destination can't be a private address
 * or a non-http(s) scheme. The extra checks here exist because — unlike an
 * ordinary crawl fetch — this result gets *persisted* and rendered: a
 * destination we'd be willing to fetch is not automatically one we're willing
 * to store in the bookmark and show to the user.
 */
export async function resolveShortenedUrl(
  url: string,
  jobId: string,
  abortSignal: AbortSignal,
  runProxy: RunProxyConfig,
): Promise<string> {
  let resolved: URL;
  try {
    resolved = await resolveValidatedRedirectUrl(
      url,
      { signal: abortSignal },
      runProxy,
    );
  } catch (error) {
    // Resolution is best effort. A failure here (timeout, redirect loop, or a
    // chain that ran into the SSRF rules) shouldn't fail the crawl: the crawler
    // revalidates the URL it actually fetches, so an unsafe link is rejected
    // there regardless.
    logger.warn(
      `[Crawler][${jobId}] Failed to resolve shortened URL "${truncateUrl(url)}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return url;
  }

  // A shortener can redirect to a URL carrying credentials. Those would end up
  // stored in the bookmark and reflected in the UI, exports and RSS feeds.
  resolved.username = "";
  resolved.password = "";

  const resolvedUrl = resolved.toString();

  if (!isAllowedBookmarkUrl(resolvedUrl)) {
    logger.warn(
      `[Crawler][${jobId}] Refusing to rewrite "${truncateUrl(url)}" to disallowed URL scheme`,
    );
    return url;
  }

  return resolvedUrl;
}
