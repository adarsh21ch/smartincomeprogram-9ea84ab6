
-- 1. Funnels: prevent plaintext access code leak to anonymous users
DROP POLICY IF EXISTS "Anyone can view published funnels" ON public.funnels;
CREATE POLICY "Anonymous can view published funnels"
  ON public.funnels FOR SELECT TO anon
  USING (is_published = true);
CREATE POLICY "Authenticated can view published funnels"
  ON public.funnels FOR SELECT TO authenticated
  USING (is_published = true);
REVOKE SELECT (access_code_plain) ON public.funnels FROM anon;
REVOKE SELECT (access_code_plain) ON public.funnels FROM authenticated;
GRANT SELECT (access_code_plain) ON public.funnels TO service_role;

-- 2. funnel_step_access: remove unrestricted public policies (edge function uses service role)
DROP POLICY IF EXISTS "Anyone can insert step access" ON public.funnel_step_access;
DROP POLICY IF EXISTS "Anyone can read step access" ON public.funnel_step_access;

-- 3. funnel_step_progress: remove public SELECT (clients use new edge function)
DROP POLICY IF EXISTS "Anyone can view step progress" ON public.funnel_step_progress;

-- 4. invite_code_uses: restrict INSERT to authenticated users for their own record
DROP POLICY IF EXISTS "public_insert_code_uses" ON public.invite_code_uses;
CREATE POLICY "authenticated_insert_code_uses" ON public.invite_code_uses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 5. member_activity_log: scope admin read to actual admins, authenticated only
DROP POLICY IF EXISTS "Admin reads all activity" ON public.member_activity_log;
CREATE POLICY "Admins read all activity" ON public.member_activity_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Storage: landing-page-assets — require ownership via folder name
DROP POLICY IF EXISTS "Users can delete own landing page assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own landing page assets" ON storage.objects;
CREATE POLICY "Users can delete own landing page assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'landing-page-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can update own landing page assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'landing-page-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 7. Function search_path mutable — pin to public
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 8. Revoke EXECUTE on internal SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_registration_coupon(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_funnel_views(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
