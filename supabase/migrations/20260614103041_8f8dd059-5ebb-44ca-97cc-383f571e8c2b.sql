
-- 1. funnel_step_progress: tighten INSERT/UPDATE
DROP POLICY IF EXISTS "Anyone can submit step progress" ON public.funnel_step_progress;
DROP POLICY IF EXISTS "Anyone can update step progress" ON public.funnel_step_progress;

CREATE POLICY "Public can insert own step progress"
  ON public.funnel_step_progress FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.is_published = true)
    AND session_id IS NOT NULL
    AND COALESCE(manually_unlocked, false) = false
    AND unlocked_by IS NULL
  );

CREATE POLICY "Public can update non-admin step progress"
  ON public.funnel_step_progress FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.is_published = true)
    AND COALESCE(manually_unlocked, false) = false
  )
  WITH CHECK (
    COALESCE(manually_unlocked, false) = false
    AND unlocked_by IS NULL
  );

-- 2. funnels.access_code_plain: revoke column read from anon/authenticated
REVOKE SELECT (access_code_plain) ON public.funnels FROM anon, authenticated;

-- 3. invite_codes: remove public read; verification stays in edge function (service role)
DROP POLICY IF EXISTS "public_verify_invite_code" ON public.invite_codes;

-- 4. funnel_step_access: add owner-only SELECT policy
CREATE POLICY "Owners can view step access grants"
  ON public.funnel_step_access FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.owner_id = auth.uid()));

-- 5. Tighten always-true public INSERT policies
DROP POLICY IF EXISTS "public_insert_access_logs" ON public.funnel_access_logs;
CREATE POLICY "public_insert_access_logs"
  ON public.funnel_access_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id));

DROP POLICY IF EXISTS "public_insert_registration" ON public.landing_page_registrations;
CREATE POLICY "public_insert_registration"
  ON public.landing_page_registrations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_pages lp WHERE lp.id = landing_page_id));

DROP POLICY IF EXISTS "public_insert_view_logs" ON public.landing_page_view_logs;
CREATE POLICY "public_insert_view_logs"
  ON public.landing_page_view_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_pages lp WHERE lp.id = landing_page_id));

-- 6. Storage: explicit UPDATE/DELETE policies for audio-notes and payment-screenshots
DROP POLICY IF EXISTS "Users update own audio notes" ON storage.objects;
CREATE POLICY "Users update own audio notes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'audio-notes' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'audio-notes' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own audio notes" ON storage.objects;
CREATE POLICY "Users delete own audio notes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-notes' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own payment screenshots" ON storage.objects;
CREATE POLICY "Users update own payment screenshots"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payment-screenshots' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'payment-screenshots' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own payment screenshots" ON storage.objects;
CREATE POLICY "Users delete own payment screenshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payment-screenshots' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 7. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated (internal/trigger/edge-only use)
REVOKE EXECUTE ON FUNCTION public.increment_funnel_views(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_landing_page_views(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_registration_coupon(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_registration_price(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_profile() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
-- has_role is referenced in RLS policies; keep authenticated EXECUTE so policy evaluation works in all contexts
