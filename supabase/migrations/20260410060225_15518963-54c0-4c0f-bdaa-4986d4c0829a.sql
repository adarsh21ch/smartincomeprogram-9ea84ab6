
-- Add new fields to program_settings
ALTER TABLE program_settings
  ADD COLUMN IF NOT EXISTS welcome_message text DEFAULT 'Welcome back, [name]! 👋',
  ADD COLUMN IF NOT EXISTS welcome_tagline text DEFAULT 'Your success journey continues today.',
  ADD COLUMN IF NOT EXISTS program_tab_title text DEFAULT 'Your Program',
  ADD COLUMN IF NOT EXISTS courses_tab_title text DEFAULT 'Your Courses',
  ADD COLUMN IF NOT EXISTS completion_message text DEFAULT 'Congratulations! You have completed the program.',
  ADD COLUMN IF NOT EXISTS certificate_signatory text DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_overview_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mentor_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mentor_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mentor_bio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mentor_photo_url text,
  ADD COLUMN IF NOT EXISTS benefits jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faq_items jsonb DEFAULT '[]'::jsonb;

-- Streak tracking
CREATE TABLE IF NOT EXISTS member_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  videos_watched integer DEFAULT 1,
  UNIQUE(member_id, activity_date)
);

ALTER TABLE member_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member owns activity log"
  ON member_activity_log FOR ALL USING (member_id = auth.uid());

CREATE POLICY "Admin reads all activity"
  ON member_activity_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Certificates
CREATE TABLE IF NOT EXISTS member_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  funnel_id uuid NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  issued_at timestamptz DEFAULT now(),
  member_name text NOT NULL,
  program_name text NOT NULL,
  signatory text,
  UNIQUE(member_id, funnel_id)
);

ALTER TABLE member_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member reads own certificate"
  ON member_certificates FOR SELECT USING (member_id = auth.uid());

CREATE POLICY "Member inserts own certificate"
  ON member_certificates FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY "Admin reads all certificates"
  ON member_certificates FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
