import { createClient } from "https://esm.sh/@supabase/supabase-js@2.101.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type } = await req.json();
    if (!type || !["program", "courses"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch program settings
    const { data: settings } = await supabase
      .from("program_settings")
      .select("active_member_funnel_id, active_courses_funnel_id")
      .limit(1)
      .single();

    if (!settings) {
      return new Response(JSON.stringify({ funnel: null, steps: [], overall_completion_percent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const funnelId = type === "program"
      ? settings.active_member_funnel_id
      : settings.active_courses_funnel_id;

    if (!funnelId) {
      return new Response(JSON.stringify({ funnel: null, steps: [], overall_completion_percent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch funnel
    const { data: funnel } = await supabase
      .from("funnels")
      .select("id, title, description")
      .eq("id", funnelId)
      .single();

    if (!funnel) {
      return new Response(JSON.stringify({ funnel: null, steps: [], overall_completion_percent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch steps
    const { data: steps } = await supabase
      .from("funnel_steps")
      .select("id, title, description, step_order, step_type, video_asset_id")
      .eq("funnel_id", funnelId)
      .eq("is_active", true)
      .order("step_order");

    // Fetch video assets for steps that have them
    const videoAssetIds = (steps || [])
      .map((s) => s.video_asset_id)
      .filter(Boolean);

    let videoAssets: Record<string, any> = {};
    if (videoAssetIds.length > 0) {
      const { data: assets } = await supabase
        .from("video_assets")
        .select("id, r2_object_key, thumbnail_url, duration_seconds")
        .in("id", videoAssetIds);

      if (assets) {
        for (const a of assets) {
          videoAssets[a.id] = a;
        }
      }
    }

    // Generate signed R2 URLs (2hr expiry)
    const r2PublicUrl = Deno.env.get("R2_PUBLIC_URL") || "";

    // Fetch progress for this user
    const { data: progressData } = await supabase
      .from("funnel_step_progress")
      .select("funnel_step_id, status, watched_percentage, completed_at, last_position_seconds")
      .eq("funnel_id", funnelId)
      .eq("session_id", user.id);

    const progressMap: Record<string, any> = {};
    if (progressData) {
      for (const p of progressData) {
        progressMap[p.funnel_step_id] = p;
      }
    }

    // Build response steps with unlock logic
    const totalSteps = (steps || []).length;
    let completedCount = 0;

    const responseSteps = (steps || []).map((step, index) => {
      const progress = progressMap[step.id];
      const isCompleted = progress?.status === "completed" || !!progress?.completed_at;
      if (isCompleted) completedCount++;

      // Unlock logic: first step always unlocked, subsequent steps unlock when previous is completed
      let isLocked = false;
      if (index > 0) {
        const prevStep = steps![index - 1];
        const prevProgress = progressMap[prevStep.id];
        const prevCompleted = prevProgress?.status === "completed" || !!prevProgress?.completed_at;
        isLocked = !prevCompleted;
      }

      const asset = step.video_asset_id ? videoAssets[step.video_asset_id] : null;
      const videoUrl = asset?.r2_object_key
        ? `${r2PublicUrl}/${asset.r2_object_key}`
        : null;

      return {
        id: step.id,
        title: step.title,
        description: step.description,
        order: step.step_order,
        step_type: step.step_type,
        video_url: videoUrl,
        thumbnail_url: asset?.thumbnail_url || null,
        duration_seconds: asset?.duration_seconds || null,
        is_locked: isLocked,
        progress: {
          watch_percent: progress?.watched_percentage || 0,
          is_completed: isCompleted,
          last_position_seconds: progress?.last_position_seconds || 0,
        },
      };
    });

    const overallPercent = totalSteps > 0
      ? Math.round((completedCount / totalSteps) * 100)
      : 0;

    return new Response(
      JSON.stringify({
        funnel: { id: funnel.id, name: funnel.title, description: funnel.description },
        steps: responseSteps,
        overall_completion_percent: overallPercent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
