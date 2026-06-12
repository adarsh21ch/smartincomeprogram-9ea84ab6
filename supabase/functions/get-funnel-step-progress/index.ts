// Public endpoint: returns funnel step progress rows for a given session_id.
// Replaces the public SELECT policy that was leaking all progress rows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { funnel_id, session_id } = await req.json();
    if (!funnel_id || !session_id) {
      return new Response(JSON.stringify({ error: "funnel_id and session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirm the funnel is published before exposing any data
    const { data: funnel } = await supabase
      .from("funnels")
      .select("id, is_published")
      .eq("id", funnel_id)
      .maybeSingle();
    if (!funnel || !funnel.is_published) {
      return new Response(JSON.stringify({ rows: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("funnel_step_progress")
      .select(
        "funnel_step_id, status, max_watched_seconds, watched_percentage, last_position_seconds, completed_at, condition_met_at, time_spent_seconds",
      )
      .eq("funnel_id", funnel_id)
      .eq("session_id", session_id);

    if (error) throw error;

    return new Response(JSON.stringify({ rows: data || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
