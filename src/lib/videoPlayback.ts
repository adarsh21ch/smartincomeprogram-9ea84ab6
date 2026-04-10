/**
 * Resolve video playback URL.
 * 
 * All video URLs should use the R2 public bucket endpoint.
 * This handles legacy cdn.nevorai.com URLs by rewriting them.
 */

const R2_PUBLIC_BASE = "https://pub-c8d06c4b7c3647d080fcde73b6422392.r2.dev";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const resolveVideoPlaybackUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Rewrite broken cdn.nevorai.com to working R2 public URL
    if (parsed.hostname === "cdn.nevorai.com") {
      return `${trimTrailingSlash(R2_PUBLIC_BASE)}${parsed.pathname}`;
    }

    // Already using R2 public URL — good
    if (parsed.hostname.includes("r2.dev")) {
      return parsed.toString();
    }

    // Any other valid URL — pass through
    return parsed.toString();
  } catch {
    return url;
  }
};
