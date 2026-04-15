
-- Drop old policies that only target public/anon role
DROP POLICY IF EXISTS "Anyone can submit step progress" ON public.funnel_step_progress;
DROP POLICY IF EXISTS "Anyone can update own step progress" ON public.funnel_step_progress;
DROP POLICY IF EXISTS "Anyone can view own progress" ON public.funnel_step_progress;

-- Recreate policies for both anon and authenticated roles

-- SELECT: anyone can view progress (for public funnels + members)
CREATE POLICY "Anyone can view step progress"
  ON public.funnel_step_progress
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: anyone can submit progress for published funnels
CREATE POLICY "Anyone can submit step progress"
  ON public.funnel_step_progress
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM funnels
      WHERE funnels.id = funnel_step_progress.funnel_id
      AND funnels.is_published = true
    )
  );

-- UPDATE: anyone can update progress for published funnels
CREATE POLICY "Anyone can update step progress"
  ON public.funnel_step_progress
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM funnels
      WHERE funnels.id = funnel_step_progress.funnel_id
      AND funnels.is_published = true
    )
  );
