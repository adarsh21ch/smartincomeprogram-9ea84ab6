import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch funnel — select only needed columns
    const { data: funnel, error: funnelErr } = await supabase
      .from("funnels")
      .select(
        "id, owner_id, title, slug, description, video_asset_id, thumbnail_url, is_published, visibility, password_hash, intent_type, allow_seek, allow_speed_change, cta_enabled, cta_text, cta_timing_seconds, cta_url, lock_cta, audio_note_url, audio_note_timing, audio_note_autoplay, audio_lock_video, show_contact_buttons, contact_whatsapp, contact_phone, contact_instagram, show_contact_after_cta, whatsapp_auto_message, whatsapp_message_template, payment_enabled, upi_id, qr_code_url, payment_instructions, total_views, funnel_mode, required_fields, access_code_plain, speaker_mode, speaker_name, speaker_photo_url, speaker_about, video_topics_enabled, video_topics"
      )
      .eq("slug", slug)
      .single();

    if (funnelErr || !funnel) {
      return new Response(JSON.stringify({ error: "Funnel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parallel fetches for related data
    const promises: Promise<{ key: string; data: unknown }>[] = [];

    // Video asset — only needed fields
    if (funnel.video_asset_id) {
      promises.push(
        supabase
          .from("video_assets")
          .select("id, title, public_url, thumbnail_url, duration_seconds, status")
          .eq("id", funnel.video_asset_id)
          .single()
          .then((r) => ({ key: "video", data: r.data }))
      );
    } else {
      promises.push(Promise.resolve({ key: "video", data: null }));
    }

    // Creator profile — only needed fields
    promises.push(
      supabase
        .from("profiles")
        .select("full_name, city, instagram_url, avatar_url, kyc_status, bio")
        .eq("id", funnel.owner_id)
        .single()
        .then((r) => ({ key: "creator", data: r.data }))
    );

    // Form config
    promises.push(
      supabase
        .from("funnel_lead_form_config")
        .select("capture_enabled, capture_timing, show_name, name_required, show_phone, phone_required, show_email, email_required, show_city, city_required, show_custom, custom_required, custom_field_label")
        .eq("funnel_id", funnel.id)
        .single()
        .then((r) => ({ key: "formConfig", data: r.data }))
    );

    // Price options
    promises.push(
      supabase
        .from("funnel_price_options")
        .select("id, label, amount, description, position")
        .eq("funnel_id", funnel.id)
        .order("position")
        .then((r) => ({ key: "priceOptions", data: r.data || [] }))
    );

    // Funnel steps (for multi-step mode) — include video asset resolution
    if (funnel.funnel_mode === "multi") {
      promises.push(
        (async () => {
          const { data: steps } = await supabase
            .from("funnel_steps")
            .select("id, step_order, title, description, step_type, video_asset_id, is_active, unlock_rule_type, unlock_rule_value, cta_text, cta_url, booking_url, unlock_condition, unlock_percentage, time_delay_enabled, time_delay_minutes, speaker_mode_step, speaker_name_custom, speaker_title, speaker_bio, speaker_photo_url_custom, video_topics_step_enabled, video_topics_step")
            .eq("funnel_id", funnel.id)
            .eq("is_active", true)
            .order("step_order");

          if (!steps || steps.length === 0) return { key: "steps", data: [] };

          // Resolve video URLs for video steps
          const videoIds = steps
            .filter((s) => s.step_type === "video" && s.video_asset_id)
            .map((s) => s.video_asset_id!);

          let videoMap: Record<string, { public_url: string | null; thumbnail_url: string | null }> = {};
          if (videoIds.length > 0) {
            const { data: videos } = await supabase
              .from("video_assets")
              .select("id, public_url, thumbnail_url")
              .in("id", videoIds);
            if (videos) {
              for (const v of videos) {
                videoMap[v.id] = { public_url: v.public_url, thumbnail_url: v.thumbnail_url };
              }
            }
          }

          // Enrich steps with video URLs
          const enrichedSteps = steps.map((s) => ({
            ...s,
            video_url: s.video_asset_id ? videoMap[s.video_asset_id]?.public_url || null : null,
            video_thumbnail: s.video_asset_id ? videoMap[s.video_asset_id]?.thumbnail_url || null : null,
          }));

          return { key: "steps", data: enrichedSteps };
        })()
      );
    } else {
      promises.push(Promise.resolve({ key: "steps", data: [] }));
    }

    // Atomic view count increment — fire-and-forget, non-blocking
    supabase.rpc("increment_funnel_views", { _funnel_id: funnel.id }).then(() => {});

    const results = await Promise.all(promises);
    const resultMap: Record<string, unknown> = {};
    for (const r of results) {
      resultMap[r.key] = r.data;
    }

    const payload = {
      funnel,
      video: resultMap.video,
      creator: resultMap.creator,
      formConfig: resultMap.formConfig,
      priceOptions: resultMap.priceOptions,
      steps: resultMap.steps,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
