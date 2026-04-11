
ALTER TABLE public.funnel_steps
  ADD COLUMN IF NOT EXISTS timer_cta_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS timer_cta_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS timer_cta_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS timer_cta_style text DEFAULT 'gold';

ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS max_submissions_per_user integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submission_cooldown_hours integer DEFAULT 0;

ALTER TABLE public.landing_page_registrations
  ADD COLUMN IF NOT EXISTS user_fingerprint text,
  ADD COLUMN IF NOT EXISTS submission_number integer DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_lp_reg_fingerprint ON public.landing_page_registrations (landing_page_id, user_fingerprint);
