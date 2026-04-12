ALTER TABLE landing_pages ALTER COLUMN theme_color SET DEFAULT '#D4AF37';

UPDATE landing_pages SET theme_color = '#D4AF37' WHERE theme_color = '#22c55e' OR theme_color IS NULL;