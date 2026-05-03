// Get scheduled-live session state (waiting / live / replay / etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let session_id: string | undefined;
    let current_timestamp: string | undefined;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      session_id = body.session_id;
      current_timestamp = body.current_timestamp;
    } else {
      const url = new URL(req.url);
      session_id = url.searchParams.get("session_id") ?? undefined;
      current_timestamp = url.searchParams.get("current_timestamp") ?? undefined;
    }

    if (!session_id) return json({ error: "session_id required" }, 400);

    const now = current_timestamp ? new Date(current_timestamp) : new Date();
    if (isNaN(now.getTime())) return json({ error: "invalid current_timestamp" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error } = await supabase
      .from("live_sessions")
      .select(
        "id, title, description, slug, status, is_published, session_type, meeting_url, " +
          "video_asset_id, funnel_id, video_duration_seconds, scheduled_times, timezone, " +
          "repeat_type, repeat_interval_hours, repeat_end_date, replay_enabled, " +
          "replay_delay_minutes, replay_expires_hours, replay_per_slot, registered_count, " +
          "max_attendees, registration_required, registration_fields, total_views, " +
          "thumbnail_url, cover_image_url",
      )
      .eq("id", session_id)
      .maybeSingle();

    if (error || !session) return json({ error: "session not found" }, 404);

    // Cancelled / unpublished
    if (!session.is_published || session.status === "cancelled") {
      return json({
        state: "cancelled",
        seek_seconds: 0,
        next_slot: null,
        current_slot_start: null,
        current_slot_end: null,
        seconds_until_next: 0,
        replay_available: false,
        replay_enabled: !!session.replay_enabled,
        video_url: null,
        session_data: pickSessionData(session),
      });
    }

    // Resolve video URL
    let video_url: string | null = session.meeting_url ?? null;
    let duration = session.video_duration_seconds ?? 0;
    if (session.video_asset_id) {
      const { data: va } = await supabase
        .from("video_assets")
        .select("public_url, duration_seconds")
        .eq("id", session.video_asset_id)
        .maybeSingle();
      if (va) {
        video_url = va.public_url ?? video_url;
        if (!duration && va.duration_seconds) duration = va.duration_seconds;
      }
    }
    // Fallback duration: if unknown, assume 2 hours so the session can still go live.
    // The player will end naturally when the video file finishes.
    if (!duration || duration <= 0) duration = 7200;

    const slotsRaw = Array.isArray(session.scheduled_times) ? session.scheduled_times : [];
    const slots = slotsRaw
      .map((s: any) => new Date(typeof s === "string" ? s : s?.value ?? s))
      .filter((d: Date) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const replayDelayMs = (session.replay_delay_minutes ?? 0) * 60_000;
    const replayEnabled = !!session.replay_enabled;
    const replayPerSlot = !!session.replay_per_slot;

    // Capacity check
    const capacityFull =
      session.max_attendees != null &&
      session.max_attendees > 0 &&
      (session.registered_count ?? 0) >= session.max_attendees;

    // Manual control: creator pressed Go Live
    if (session.status === "live") {
      // Find current slot if any, else assume started now
      const currentSlot = slots.find(
        (s) => now.getTime() >= s.getTime() && now.getTime() <= s.getTime() + duration * 1000,
      );
      const slotStart = currentSlot ?? now;
      const slotEnd = new Date(slotStart.getTime() + duration * 1000);
      return json({
        state: capacityFull ? "full" : "live",
        seek_seconds: Math.max(0, Math.floor((now.getTime() - slotStart.getTime()) / 1000)),
        next_slot: null,
        current_slot_start: slotStart.toISOString(),
        current_slot_end: slotEnd.toISOString(),
        seconds_until_next: 0,
        replay_available: false,
        replay_enabled: replayEnabled,
        video_url,
        session_data: pickSessionData(session),
      });
    }

    if (slots.length === 0 || duration <= 0) {
      // Nothing scheduled yet
      return json({
        state: "waiting",
        seek_seconds: 0,
        next_slot: null,
        current_slot_start: null,
        current_slot_end: null,
        seconds_until_next: 0,
        replay_available: false,
        replay_enabled: replayEnabled,
        video_url,
        session_data: pickSessionData(session),
      });
    }

    // Build slot windows
    const windows = slots.map((s) => ({
      start: s,
      end: new Date(s.getTime() + duration * 1000),
    }));

    const earliest = windows[0];
    const last = windows[windows.length - 1];

    // Currently inside a slot?
    const current = windows.find(
      (w) => now.getTime() >= w.start.getTime() && now.getTime() <= w.end.getTime(),
    );
    if (current) {
      const seek = Math.floor((now.getTime() - current.start.getTime()) / 1000);
      return json({
        state: capacityFull ? "full" : "live",
        seek_seconds: Math.max(0, Math.min(seek, duration)),
        next_slot: nextFuture(windows, now)?.start.toISOString() ?? null,
        current_slot_start: current.start.toISOString(),
        current_slot_end: current.end.toISOString(),
        seconds_until_next: 0,
        replay_available: false,
        replay_enabled: replayEnabled,
        video_url,
        session_data: pickSessionData(session),
      });
    }

    // Before earliest
    if (now.getTime() < earliest.start.getTime()) {
      const sec = Math.floor((earliest.start.getTime() - now.getTime()) / 1000);
      return json({
        state: capacityFull ? "full" : "waiting",
        seek_seconds: 0,
        next_slot: earliest.start.toISOString(),
        current_slot_start: null,
        current_slot_end: null,
        seconds_until_next: sec,
        replay_available: false,
        replay_enabled: replayEnabled,
        video_url,
        session_data: pickSessionData(session),
      });
    }

    // After some slot but more in future
    const next = nextFuture(windows, now);
    const justEnded = [...windows].reverse().find((w) => w.end.getTime() < now.getTime());

    if (next) {
      const sec = Math.floor((next.start.getTime() - now.getTime()) / 1000);
      const replayReady =
        replayEnabled &&
        replayPerSlot &&
        justEnded &&
        now.getTime() >= justEnded.end.getTime() + replayDelayMs;
      return json({
        state: replayReady ? "replay" : "between_slots",
        seek_seconds: 0,
        next_slot: next.start.toISOString(),
        current_slot_start: justEnded?.start.toISOString() ?? null,
        current_slot_end: justEnded?.end.toISOString() ?? null,
        seconds_until_next: sec,
        replay_available: !!replayReady,
        replay_enabled: replayEnabled,
        video_url,
        session_data: pickSessionData(session),
      });
    }

    // After last slot
    const replayReady = replayEnabled && now.getTime() >= last.end.getTime() + replayDelayMs;
    const replayExpired =
      replayEnabled &&
      session.replay_expires_hours &&
      now.getTime() >
        last.end.getTime() + replayDelayMs + session.replay_expires_hours * 3_600_000;
    return json({
      state: replayReady && !replayExpired ? "replay" : "ended",
      seek_seconds: 0,
      next_slot: null,
      current_slot_start: last.start.toISOString(),
      current_slot_end: last.end.toISOString(),
      seconds_until_next: 0,
      replay_available: !!(replayReady && !replayExpired),
      replay_enabled: replayEnabled,
      video_url,
      session_data: pickSessionData(session),
    });
  } catch (e) {
    console.error("get-live-session-state error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function nextFuture(windows: { start: Date; end: Date }[], now: Date) {
  return windows.find((w) => w.start.getTime() > now.getTime()) ?? null;
}

function pickSessionData(s: any) {
  return {
    title: s.title,
    description: s.description,
    slug: s.slug,
    speaker_name: s.speaker_name ?? null,
    speaker_photo: s.speaker_photo ?? null,
    speaker_bio: s.speaker_bio ?? null,
    max_attendees: s.max_attendees ?? null,
    registered_count: s.registered_count ?? 0,
    scheduled_times: s.scheduled_times ?? [],
    repeat_type: s.repeat_type ?? "once",
    is_published: !!s.is_published,
    replay_enabled: !!s.replay_enabled,
    replay_delay_minutes: s.replay_delay_minutes ?? 0,
    registration_required: !!s.registration_required,
    registration_fields: s.registration_fields ?? { name: true, email: true, phone: false },
    thumbnail_url: s.thumbnail_url ?? s.cover_image_url ?? null,
    timezone: s.timezone ?? "Asia/Kolkata",
  };
}
