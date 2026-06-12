// Authoritative server-side registration flow for paid landing pages.
// The browser's claimed price is IGNORED. Price is recomputed here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const RAZORPAY_API = "https://api.razorpay.com/v1";

function rzpHeaders() {
  return {
    Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      landing_page_id,
      name,
      email,
      phone,
      dob, // YYYY-MM-DD
      state,
      city,
      occupation,
      custom_1_value,
      custom_2_value,
      coupon_code,
      honeypot,
      user_agent,
      client_id,
    } = body || {};

    if (honeypot) return json({ success: true }); // silent fake-success

    if (!landing_page_id) return json({ success: false, message: "landing_page_id required" }, 400);

    const { data: page, error: pageErr } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("id", landing_page_id)
      .eq("status", "published")
      .single();

    if (pageErr || !page) return json({ success: false, message: "Landing page not found" }, 404);

    // ---- Server-side price computation (NEVER trust client) ----
    const paidEnabled = !!page.registration_paid_enabled;
    const basePrice: number = Number(page.registration_price_inr || 0);
    let finalPrice = paidEnabled ? basePrice : 0;
    let couponId: string | null = null;
    let couponCodeNorm: string | null = null;

    if (paidEnabled && coupon_code && String(coupon_code).trim().length > 0) {
      couponCodeNorm = String(coupon_code).trim().toUpperCase();
      const { data: c } = await supabase
        .from("registration_coupons")
        .select("*")
        .eq("landing_page_id", landing_page_id)
        .eq("is_active", true)
        .ilike("code", couponCodeNorm)
        .maybeSingle();

      if (!c) return json({ success: false, reason: "invalid_coupon", message: "Invalid coupon code" });
      if (c.max_uses != null && c.used_count >= c.max_uses) {
        return json({ success: false, reason: "coupon_exhausted", message: "Coupon fully used" });
      }
      finalPrice = Number(c.final_price_inr || 0);
      couponId = c.id;
    }

    // Basic field validation (mirror existing submit-landing-page-registration rules)
    if (page.field_email_enabled && page.field_email_required && !email) {
      return json({ success: false, message: "Email is required" });
    }
    if (page.field_name_enabled && page.field_name_required && !name) {
      return json({ success: false, message: "Name is required" });
    }
    if (page.field_phone_enabled && page.field_phone_required && !phone) {
      return json({ success: false, message: "Phone is required" });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: "Please enter a valid email address" });
    }

    let computedAge: number | null = null;
    if (page.field_age_enabled && dob) {
      const d = new Date(dob);
      if (isNaN(d.getTime())) return json({ success: false, message: "Invalid date of birth" });
      const today = new Date();
      let yrs = today.getFullYear() - d.getFullYear();
      const m = today.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < d.getDate())) yrs--;
      computedAge = yrs;
      if (page.min_age_enabled && computedAge < (page.min_age ?? 18)) {
        return json({ success: false, message: `You must be ${page.min_age ?? 18} or older to register.` });
      }
    }

    // ============ FREE PATH ============
    if (finalPrice <= 0) {
      // Atomically claim coupon (if any) BEFORE inserting registration
      if (couponId) {
        const { data: claimed, error: claimErr } = await supabase.rpc("claim_registration_coupon", {
          p_coupon_id: couponId,
        });
        if (claimErr) throw claimErr;
        if (claimed !== true) {
          return json({ success: false, reason: "coupon_exhausted", message: "Coupon fully used" });
        }
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const deviceType = user_agent && /Mobi/i.test(user_agent) ? "mobile" : "desktop";

      const { data: reg, error: insErr } = await supabase
        .from("landing_page_registrations")
        .insert({
          landing_page_id,
          owner_id: page.owner_id,
          name: name || null,
          phone: phone || null,
          email: email || null,
          age: computedAge !== null ? String(computedAge) : null,
          dob: dob || null,
          city: city || null,
          state: state || null,
          occupation: occupation || null,
          custom_1_value: custom_1_value || null,
          custom_2_value: custom_2_value || null,
          ip_address: ip,
          device_type: deviceType,
          user_agent: user_agent || null,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      await supabase.from("registration_payments").insert({
        landing_page_id,
        registration_id: reg.id,
        registrant_name: name || null,
        registrant_email: email || null,
        registrant_phone: phone || null,
        coupon_code: couponCodeNorm,
        coupon_id: couponId,
        amount_inr: 0,
        status: "free",
      });

      // Fire confirmation email in background (best-effort)
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        // @ts-ignore
        EdgeRuntime.waitUntil(
          fetch(`${SUPABASE_URL}/functions/v1/send-landing-page-confirmation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ registration_id: reg.id }),
          }).catch(() => {}),
        );
      } catch { /* ignore */ }

      return json({ success: true, mode: "free", registration_id: reg.id });
    }

    // ============ PAID PATH ============
    // Create Razorpay order
    const orderRes = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: rzpHeaders(),
      body: JSON.stringify({
        amount: Math.round(finalPrice * 100),
        currency: "INR",
        receipt: `lpreg_${landing_page_id.slice(0, 8)}_${Date.now()}`,
        notes: {
          kind: "landing_page_registration",
          landing_page_id,
          coupon_id: couponId || "",
          email: email || "",
        },
      }),
    });
    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error("Razorpay order failed:", errText);
      return json({ success: false, message: "Failed to create payment order" }, 500);
    }
    const order = await orderRes.json();

    // Store pending payment row (NO registration yet — only after verify)
    const { data: payRow, error: payErr } = await supabase
      .from("registration_payments")
      .insert({
        landing_page_id,
        registrant_name: name || null,
        registrant_email: email || null,
        registrant_phone: phone || null,
        coupon_code: couponCodeNorm,
        coupon_id: couponId,
        amount_inr: finalPrice,
        razorpay_order_id: order.id,
        status: "pending",
      })
      .select("id")
      .single();
    if (payErr) throw payErr;

    return json({
      success: true,
      mode: "paid",
      payment_id: payRow.id,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpay_key_id: RAZORPAY_KEY_ID,
      // Cache the form payload server-side via the payment row? Simpler: client re-sends on verify.
    });
  } catch (err: any) {
    console.error("register-with-payment error:", err);
    return json({ success: false, message: err?.message || "Server error" }, 500);
  }
});
