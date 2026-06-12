
-- 1. Extend landing_pages with pricing fields
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS registration_price_inr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_paid_enabled boolean NOT NULL DEFAULT false;

-- 2. Coupons (per landing page)
CREATE TABLE IF NOT EXISTS public.registration_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  code text NOT NULL,
  final_price_inr integer NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (landing_page_id, code)
);
CREATE INDEX IF NOT EXISTS idx_registration_coupons_page ON public.registration_coupons(landing_page_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_coupons TO authenticated;
GRANT ALL ON public.registration_coupons TO service_role;
ALTER TABLE public.registration_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_owner_all" ON public.registration_coupons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.landing_pages lp
                 WHERE lp.id = registration_coupons.landing_page_id
                   AND lp.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_pages lp
                      WHERE lp.id = registration_coupons.landing_page_id
                        AND lp.owner_id = auth.uid()));

CREATE TRIGGER trg_registration_coupons_updated_at
  BEFORE UPDATE ON public.registration_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Registration payments (one row per registration attempt; paid OR free)
CREATE TABLE IF NOT EXISTS public.registration_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.landing_page_registrations(id) ON DELETE SET NULL,
  registrant_name text,
  registrant_email text,
  registrant_phone text,
  coupon_code text,
  coupon_id uuid REFERENCES public.registration_coupons(id) ON DELETE SET NULL,
  amount_inr integer NOT NULL DEFAULT 0,
  razorpay_order_id text,
  razorpay_payment_id text,
  status text NOT NULL DEFAULT 'pending',  -- pending | paid | free | failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_regpay_page ON public.registration_payments(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_regpay_order ON public.registration_payments(razorpay_order_id);

GRANT SELECT ON public.registration_payments TO authenticated;
GRANT ALL ON public.registration_payments TO service_role;
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regpay_owner_read" ON public.registration_payments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.landing_pages lp
                 WHERE lp.id = registration_payments.landing_page_id
                   AND lp.owner_id = auth.uid()));

CREATE TRIGGER trg_registration_payments_updated_at
  BEFORE UPDATE ON public.registration_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Public RPC for previewing price (server-computed)
CREATE OR REPLACE FUNCTION public.get_registration_price(p_landing_page_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base integer;
  v_paid boolean;
  v_coupon record;
BEGIN
  SELECT registration_price_inr, registration_paid_enabled
    INTO v_base, v_paid
  FROM public.landing_pages
  WHERE id = p_landing_page_id;

  IF v_base IS NULL THEN
    RETURN jsonb_build_object('error', 'Landing page not found');
  END IF;

  IF NOT COALESCE(v_paid, false) THEN
    RETURN jsonb_build_object('price', 0, 'base_price', 0, 'coupon_applied', false, 'paid_enabled', false);
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('price', v_base, 'base_price', v_base, 'coupon_applied', false, 'paid_enabled', true);
  END IF;

  SELECT * INTO v_coupon
  FROM public.registration_coupons
  WHERE landing_page_id = p_landing_page_id
    AND upper(code) = upper(trim(p_code))
    AND is_active = true;

  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('price', v_base, 'base_price', v_base, 'coupon_applied', false, 'paid_enabled', true, 'error', 'Invalid coupon');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('price', v_base, 'base_price', v_base, 'coupon_applied', false, 'paid_enabled', true, 'error', 'Coupon fully used');
  END IF;

  RETURN jsonb_build_object(
    'price', v_coupon.final_price_inr,
    'base_price', v_base,
    'coupon_applied', true,
    'paid_enabled', true,
    'coupon_id', v_coupon.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_registration_price(uuid, text) TO anon, authenticated;

-- 5. Atomic coupon claim (service-role only is fine; SECURITY DEFINER so edge fn can call)
CREATE OR REPLACE FUNCTION public.claim_registration_coupon(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.registration_coupons
  SET used_count = used_count + 1, updated_at = now()
  WHERE id = p_coupon_id
    AND is_active = true
    AND (max_uses IS NULL OR used_count < max_uses)
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_registration_coupon(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_coupon(uuid) TO service_role;
