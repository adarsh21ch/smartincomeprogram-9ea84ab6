## Problem

Clicking "Register for Program" sometimes opens `/auth` (Login/Signup) instead of the public registration landing page (`/l/smart-income-program`).

Root cause: each Register button (in `SipHero`, `SipCta`, `SipCommunity`) independently fires an async query to fetch the landing page slug from `program_settings.active_register_landing_page_id`. While that query is pending — or if it returns no data — the `<Link to={…}>` falls back to `"/auth?tab=signup"`. If the user clicks before the query resolves, or the query returns null for any reason, they land on the auth page.

A registration landing page does exist and is public:
- `program_settings.active_register_landing_page_id` → `smart-income-program` (status `published`)
- Public viewer route `/l/:slug` (`PublicLandingPage`) does NOT require login.

## Fix

1. **Centralize the register URL** in `useSipLandingData` (the hook already used by `Index.tsx`). It will:
   - Read `program_settings.active_register_landing_page_id`.
   - Fetch the matching `landing_pages.slug` (status = `published`).
   - Expose `registerUrl` (string) + `registerReady` (boolean).
   - If unresolved, default `registerUrl` to the known published slug `/l/smart-income-program` instead of `/auth?tab=signup`, so registration is never gated behind login.

2. **Pass `registerUrl` down as a prop** from `Index.tsx` to `SipHero`, `SipCta`, `SipCommunity`. Remove their local `useQuery` lookups and the local `RegisterButton` component in `SipHero`. All three buttons render a stable `<Link to={registerUrl}>` from first paint.

3. **Keep the standalone "Login / Sign Up"** button (Hero) and Navbar "Login" link pointing to `/auth` — only the Register CTAs change.

4. No backend, schema, or RLS changes. `landing_pages` and `program_settings` already allow public read for the published row, so this is purely a frontend wiring fix.

## Files touched

- `src/hooks/useSipLandingData.tsx` — add `registerUrl` resolution + export.
- `src/pages/Index.tsx` — pass `registerUrl` into the three section components.
- `src/components/sip-landing/SipHero.tsx` — accept `registerUrl` prop, drop local query/`RegisterButton`.
- `src/components/sip-landing/SipCta.tsx` — accept `registerUrl` prop, drop local query.
- `src/components/sip-landing/SipCommunity.tsx` — accept `registerUrl` prop, drop local query.

## Verification

- Load `/` as a logged-out visitor; click each "Register for Program" CTA (hero, mid-page community, bottom CTA) → all navigate to `/l/smart-income-program`, which renders the public registration form with no auth wall.
- Navbar "Login" still goes to `/auth`.
