ALTER TABLE public.landing_page_testimonials
  ADD COLUMN IF NOT EXISTS video_orientation text DEFAULT 'portrait',
  ADD COLUMN IF NOT EXISTS video_width integer,
  ADD COLUMN IF NOT EXISTS video_height integer;