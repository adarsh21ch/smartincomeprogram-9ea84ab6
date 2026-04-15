
-- Fix member_activity_log policies to include authenticated role
DROP POLICY IF EXISTS "Member owns activity log" ON public.member_activity_log;
DROP POLICY IF EXISTS "Admin reads all activity" ON public.member_activity_log;

-- Members manage their own activity
CREATE POLICY "Member owns activity log"
  ON public.member_activity_log
  FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Admin reads all
CREATE POLICY "Admin reads all activity"
  ON public.member_activity_log
  FOR SELECT
  TO anon, authenticated
  USING (true);
