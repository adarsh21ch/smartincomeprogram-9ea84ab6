GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_landing_page_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_funnel_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_price(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_coupon(uuid) TO anon, authenticated;