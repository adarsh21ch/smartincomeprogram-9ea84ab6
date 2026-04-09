
-- Table: sip_landing_page_config
CREATE TABLE IF NOT EXISTS public.sip_landing_page_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  key text NOT NULL,
  value_text text DEFAULT '',
  value_image_url text DEFAULT '',
  value_boolean boolean DEFAULT false,
  value_number integer DEFAULT 0,
  value_json jsonb DEFAULT '{}',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(section, key)
);

ALTER TABLE public.sip_landing_page_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_sip_config" ON public.sip_landing_page_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_read_sip_config" ON public.sip_landing_page_config
  FOR SELECT USING (is_active = true);

-- Table: sip_speakers
CREATE TABLE IF NOT EXISTS public.sip_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  bio text DEFAULT '',
  photo_url text DEFAULT '',
  achievements text[] DEFAULT '{}',
  instagram_url text DEFAULT '',
  youtube_url text DEFAULT '',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sip_speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_sip_speakers" ON public.sip_speakers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_read_sip_speakers" ON public.sip_speakers
  FOR SELECT USING (is_active = true);

-- Table: sip_testimonials
CREATE TABLE IF NOT EXISTS public.sip_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text DEFAULT '',
  role text DEFAULT '',
  quote text NOT NULL,
  photo_url text DEFAULT '',
  rating integer DEFAULT 5,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sip_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_sip_testimonials" ON public.sip_testimonials
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_read_sip_testimonials" ON public.sip_testimonials
  FOR SELECT USING (is_active = true);

-- Table: sip_journey_steps
CREATE TABLE IF NOT EXISTS public.sip_journey_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_number integer NOT NULL,
  icon text DEFAULT '→',
  title text NOT NULL,
  description text DEFAULT '',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE public.sip_journey_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_sip_journey" ON public.sip_journey_steps
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_read_sip_journey" ON public.sip_journey_steps
  FOR SELECT USING (is_active = true);

-- Table: sip_faq_items
CREATE TABLE IF NOT EXISTS public.sip_faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE public.sip_faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_sip_faq" ON public.sip_faq_items
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "public_read_sip_faq" ON public.sip_faq_items
  FOR SELECT USING (is_active = true);

-- Seed hero defaults
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('hero', 'badge_text', 'Private Members Community'),
('hero', 'headline_line1', 'Build Your Income.'),
('hero', 'headline_line2', 'Build Your Future.'),
('hero', 'subtitle', 'A structured learning and growth platform for driven individuals ready to build a secondary income through proven systems.'),
('hero', 'primary_button_text', 'Join the Program →'),
('hero', 'secondary_button_text', 'Watch Introduction ▶'),
('hero', 'secondary_button_url', ''),
('hero', 'trust_1', '🔒 Private Community'),
('hero', 'trust_2', '📚 Structured Learning'),
('hero', 'trust_3', '🏆 Proven System'),
('hero', 'bg_glow', 'true')
ON CONFLICT (section, key) DO NOTHING;

-- Seed about defaults
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('about', 'heading', 'What is Smart Income Program?'),
('about', 'body', E'Smart Income Program is a private, members-only platform designed to help driven individuals build a secondary income through structured learning, expert mentorship, and proven systems.\n\nOur program provides a step-by-step digital learning experience with access to training videos, live sessions, and a supportive community of like-minded individuals.\n\nWhether you are new to network marketing or looking to scale your existing team, our platform gives you the tools and knowledge to succeed.'),
('about', 'image_url', ''),
('about', 'feature_1_icon', '🎯'),
('about', 'feature_1_title', 'Goal-Oriented'),
('about', 'feature_1_desc', 'Clear milestones and structured learning paths to keep you on track.'),
('about', 'feature_2_icon', '📱'),
('about', 'feature_2_title', 'Digital Tools'),
('about', 'feature_2_desc', 'Access training videos, funnels, and resources from any device.'),
('about', 'feature_3_icon', '👥'),
('about', 'feature_3_title', 'Community'),
('about', 'feature_3_desc', 'Connect with like-minded individuals and grow together.'),
('about', 'feature_4_icon', '📈'),
('about', 'feature_4_title', 'Proven System'),
('about', 'feature_4_desc', 'Follow a tested blueprint that has helped hundreds of members.')
ON CONFLICT (section, key) DO NOTHING;

-- Seed speakers heading
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('speakers', 'heading', 'Learn From Those Who Have Done It')
ON CONFLICT (section, key) DO NOTHING;

-- Seed journey heading
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('journey', 'heading', 'Your Path to Success, Step by Step')
ON CONFLICT (section, key) DO NOTHING;

-- Seed community section
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('community', 'heading', 'A Private Community Built for Growth'),
('community', 'body', 'Join a supportive network of driven individuals who are building their income together through shared knowledge, expert guidance, and proven strategies.'),
('community', 'feature_1_icon', '📚'),
('community', 'feature_1_title', 'Structured Learning'),
('community', 'feature_1_desc', 'Step-by-step training designed to take you from beginner to expert.'),
('community', 'feature_2_icon', '🎓'),
('community', 'feature_2_title', 'Expert Mentorship'),
('community', 'feature_2_desc', 'Learn directly from leaders who have built successful teams.'),
('community', 'feature_3_icon', '🏆'),
('community', 'feature_3_title', 'Proven System'),
('community', 'feature_3_desc', 'A blueprint that has helped hundreds of members achieve their goals.'),
('community', 'cta_text', 'Join the Community →'),
('community', 'cta_url', '/auth?tab=signup')
ON CONFLICT (section, key) DO NOTHING;

-- Seed testimonials heading
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('testimonials', 'heading', 'What Our Members Say')
ON CONFLICT (section, key) DO NOTHING;

-- Seed FAQ heading
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('faq', 'heading', 'Frequently Asked Questions')
ON CONFLICT (section, key) DO NOTHING;

-- Seed CTA
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('cta', 'heading', 'Ready to Build Your Income?'),
('cta', 'subtitle', 'Join the Smart Income Program and start your journey today.'),
('cta', 'button_text', 'Request Access →'),
('cta', 'button_url', '/auth?tab=signup')
ON CONFLICT (section, key) DO NOTHING;

-- Seed disclaimer
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('disclaimer', 'show', 'true'),
('disclaimer', 'content', E'Smart Income Program is a private educational platform designed for members of our network marketing team. This platform and its contents are intended for internal training and educational purposes only.\n\nIncome results are not guaranteed. Individual results may vary based on effort, skills, and market conditions. The testimonials shown are from real members and represent their individual experiences.\n\nThis platform is not affiliated with any third-party organization or company. For questions, contact the program administrator.')
ON CONFLICT (section, key) DO NOTHING;

-- Seed footer
INSERT INTO public.sip_landing_page_config (section, key, value_text) VALUES
('footer', 'tagline', 'Build your income. Build your future.')
ON CONFLICT (section, key) DO NOTHING;

-- Seed journey steps
INSERT INTO public.sip_journey_steps (step_number, title, description, display_order) VALUES
(1, 'Get Your Invite Code', 'Receive your private invite code from your team leader or mentor.', 1),
(2, 'Create Your Account', 'Sign up using your invite code to join the private community.', 2),
(3, 'Start Learning', 'Access structured video training, step by step, at your own pace.', 3),
(4, 'Connect with Mentors', 'Work with your mentor to apply what you learn and grow your team.', 4);

-- Seed FAQ items
INSERT INTO public.sip_faq_items (question, answer, display_order) VALUES
('Who is this program for?', 'This program is designed for team leaders and members of our network marketing organization who want to learn and grow through structured digital training.', 1),
('How do I join?', 'You need a private invite code from your team leader. Once you have the code, visit this page and click Join the Program to create your account.', 2),
('Is the content available on mobile?', 'Yes. The platform works on all devices including mobile phones, tablets, and computers.', 3),
('What kind of content is available?', 'The program includes training videos, step-by-step learning journeys, audio notes from mentors, and community resources.', 4);
