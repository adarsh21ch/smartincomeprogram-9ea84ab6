// Verifies Razorpay payment signature, then creates the registration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

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
      payment_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // re-sent form data so we can create the registration row after verify
      registration: reg,
      user_agent,
    } = body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ success: false, message: "Missing payment verification fields" }, 400);
    }

    // 1. Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(RAZORPAY_KEY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigData = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
    const sig = await crypto.subtle.sign("HMAC", key, sigData);
    const expectedSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSig !== razorpay_signature) {
      await supabase
        .from("registration_payments")
        .update({ status: "failed", razorpay_payment_id })
        .eq("razorpay_order_id", razorpay_order_id);
      return json({ success: false, message: "Payment signature mismatch" }, 400);
    }

    // 2. Look up the pending payment row
    const { data: payRow, error: payErr } = await supabase
      .from("registration_payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();
    if (payErr || !payRow) return json({ success: false, message: "Payment record not found" }, 404);

    // Idempotent — if already paid + registration exists, return success
    if (payRow.status === "paid" && payRow.registration_id) {
      return json({ success: true, registration_id: payRow.registration_id, already: true });
    }

    // 3. Claim coupon atomically (if any). If it just got exhausted by a parallel
    //    free path, we still honor this paid registration — the user already paid.
    if (payRow.coupon_id) {
      await supabase.rpc("claim_registration_coupon", { p_coupon_id: payRow.coupon_id });
    }

    // 4. Get landing page for owner_id
    const { data: page } = await supabase
      .from("landing_pages")
      .select("id, owner_id, field_age_enabled, min_age_enabled, min_age")
      .eq("id", payRow.landing_page_id)
      .single();
    if (!page) return json({ success: false, message: "Landing page not found" }, 404);

    let computedAge: number | null = null;
    if (reg?.dob) {
      const d = new Date(reg.dob);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        let yrs = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) yrs--;
        computedAge = yrs;
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const deviceType = user_agent && /Mobi/i.test(user_agent) ? "mobile" : "desktop";

    const { data: registration, error: insErr } = await supabase
      .from("landing_page_registrations")
      .insert({
        landing_page_id: payRow.landing_page_id,
        owner_id: page.owner_id,
        name: reg?.name || payRow.registrant_name || null,
        phone: reg?.phone || payRow.registrant_phone || null,
        email: reg?.email || payRow.registrant_email || null,
        age: computedAge !== null ? String(computedAge) : null,
        dob: reg?.dob || null,
        city: reg?.city || null,
        state: reg?.state || null,
        occupation: reg?.occupation || null,
        custom_1_value: reg?.custom_1_value || null,
        custom_2_value: reg?.custom_2_value || null,
        ip_address: ip,
        device_type: deviceType,
        user_agent: user_agent || null,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    await supabase
      .from("registration_payments")
      .update({
        status: "paid",
        razorpay_payment_id,
        registration_id: registration.id,
      })
      .eq("id", payRow.id);

    // Background email
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
          body: JSON.stringify({ registration_id: registration.id }),
        }).catch(() => {}),
      );
    } catch { /* ignore */ }

    return json({ success: true, registration_id: registration.id });
  } catch (err: any) {
    console.error("verify-registration-payment error:", err);
    return json({ success: false, message: err?.message || "Server error" }, 500);
  }
});
