
-- Add placement column
ALTER TABLE landing_page_testimonials
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'registration';

-- Add rating column
ALTER TABLE landing_page_testimonials
  ADD COLUMN IF NOT EXISTS rating integer NOT NULL DEFAULT 5;

-- Backfill existing rows
UPDATE landing_page_testimonials SET placement = 'registration' WHERE placement IS NULL;
UPDATE landing_page_testimonials SET rating = 5 WHERE rating IS NULL;

-- Backfill type based on content
UPDATE landing_page_testimonials SET type = 'video' WHERE type IS NULL AND video_url IS NOT NULL;
UPDATE landing_page_testimonials SET type = 'text' WHERE type IS NULL AND video_url IS NULL AND review_text IS NOT NULL;
UPDATE landing_page_testimonials SET type = 'text' WHERE type IS NULL;
