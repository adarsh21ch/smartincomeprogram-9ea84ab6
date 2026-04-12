
CREATE TABLE IF NOT EXISTS public.course_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text DEFAULT '🎓',
  badge_text text DEFAULT 'Members Only',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.course_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active course cards"
  ON public.course_cards FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manages course cards"
  ON public.course_cards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.course_cards (title, description, icon, badge_text, display_order) VALUES
  ('Novas & Above Trainings', 'Exclusive training sessions for Novas rank and above members. Level up your network marketing skills.', '⭐', 'Novas & Above', 1),
  ('ASN & Above Trainings', 'Advanced training for ASN rank and above. Deep dive into leadership and team building.', '🌟', 'ASN & Above', 2),
  ('Super ASN & Above Trainings', 'Premium training reserved for Super ASN rank and above. Master the art of duplication.', '💫', 'Super ASN & Above', 3),
  ('Manager & Above Trainings', 'Exclusive manager-level training on advanced strategies, team management and scaling.', '👑', 'Manager & Above', 4),
  ('Smart Income Club Trainings', 'Special sessions exclusively for Smart Income Club members. Elite content for top performers.', '🏆', 'SIP Club Only', 5),
  ('Personal Branding & Content Creation', 'Learn to build your personal brand and create content that attracts prospects automatically.', '🎯', 'All Members', 6);
