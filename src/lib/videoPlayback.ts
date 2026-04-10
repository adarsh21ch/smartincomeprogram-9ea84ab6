const FALLBACK_PUBLIC_R2_BASE = "https://pub-c8d06c4b7c3647d080fcde73b6422392.r2.dev";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const resolveVideoPlaybackUrl = (url: string | null | undefined) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname === "cdn.nevorai.com" && parsed.pathname.startsWith("/videos/")) {
      return `${trimTrailingSlash(FALLBACK_PUBLIC_R2_BASE)}${parsed.pathname}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
};