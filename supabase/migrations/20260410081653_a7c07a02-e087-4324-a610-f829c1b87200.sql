ALTER TABLE public.landing_pages
ADD COLUMN testimonials_display_position TEXT NOT NULL DEFAULT 'post_registration';

COMMENT ON COLUMN public.landing_pages.testimonials_display_position IS 'Where to show testimonials: registration, post_registration, or both';