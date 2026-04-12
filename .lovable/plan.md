

## Plan: Hide Redundant Progress Bar on Mobile

### Problem
On mobile, the "Up Next — Locked" section's progress bar (showing "6% / 95% needed") appears directly below the video player's seek bar, creating visual clutter.

### Change

**File: `src/components/member/ProgramTab.tsx`** (UpNextSection component, ~lines 519-530)

- Wrap the progress bar and percentage text inside the locked "Up Next" section with a `hidden md:block` class, so it only shows on tablet/desktop
- On mobile, users still see the "Up Next — Locked" label, step title, and condition text — just not the redundant progress bar
- The video player's own yellow seek bar remains the single progress indicator on mobile

This is a one-line CSS class change — no logic changes needed.

