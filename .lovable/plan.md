
What I found

- This does not look like a secrets/account problem anymore. The latest video reaches `status: "ready"`, has a public URL, and the session replay shows it can open and partially play/seek.
- The strongest signal is now the browser-side media error: `EmptyRanges` with `played/buffered/syncControl`. That points to the browser’s native media controls path, and `/admin/videos` is using `StreamingVideo` with native `controls`.
- The uploaded file is also very large (~288 MB), and uploads are currently not saving `duration_seconds`, so the app has no metadata-based fallback when a raw MP4 is slow or fragile to stream.
- There are still a few inconsistent video surfaces (`StreamingVideo`, `PublicFunnel`, `VideoPlayer`, `VideosPage`) using different playback logic.

Plan

1. Stabilize the shared preview player
- Rework `src/components/StreamingVideo.tsx` to stop depending on browser-native `controls` for admin/public preview surfaces.
- Use a small custom control layer instead: play/pause, mute, retry, loading/buffering states.
- Convert it to `forwardRef` as well, so the current ref warning stops firing.

2. Harden playback logic across all players
- Add safe guards before reading `buffered`, `duration`, and `currentTime` in:
  - `src/components/StreamingVideo.tsx`
  - `src/components/member/VideoPlayer.tsx`
  - `src/pages/PublicFunnel.tsx`
- Only allow seek operations after metadata is loaded.
- Replace fragile recovery like forced `currentTime = currentTime` nudges with safer retry/reload behavior.

3. Unify video handling everywhere
- Update `src/pages/VideosPage.tsx` to stop using a raw `<video>` preview and use the same resolved playback path + metadata preload strategy as the shared player.
- Keep all surfaces on the same playback URL resolver and preload behavior.

4. Restore lightweight upload metadata
- Update `src/lib/r2VideoUpload.ts` to extract duration with the lightweight helper and send `durationSeconds` to `confirm-r2-upload`.
- This will let the UI detect problematic uploads more reliably and stop showing blank/ambiguous states.

5. Add a clear fallback for problematic MP4s
- If first-frame/metadata loading fails or stalls too long, show a specific “video file is not web-optimized” message instead of leaving the player stuck pausing/spinning.
- This is important because very large raw MP4s can still behave badly even when storage and URLs are correct.

Technical details

- Files to update:
  - `src/components/StreamingVideo.tsx`
  - `src/components/member/VideoPlayer.tsx`
  - `src/pages/PublicFunnel.tsx`
  - `src/pages/VideosPage.tsx`
  - `src/lib/r2VideoUpload.ts`
- No database schema or secret changes should be needed.
- Expected result:
  - Admin preview stops randomly pausing due to native-control instability
  - Public/member playback becomes more consistent
  - Large uploads fail more gracefully when the file itself is the problem
- After implementation I would verify end-to-end on:
  - `/admin/videos` modal
  - public shared video page
  - landing-page post-submit video
  - funnel/member player
