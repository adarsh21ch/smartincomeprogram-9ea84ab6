import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPickerModal } from "@/components/VideoPickerModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Video, Link as LinkIcon, ChevronLeft, ChevronRight, Check, X,
  Calendar as CalIcon, Trash2, Plus, AlertTriangle,
} from "lucide-react";

const generateSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "session";

type RepeatType = "once" | "daily" | "interval" | "custom";

interface SessionRow {
  id?: string;
  title?: string;
  description?: string | null;
  session_type?: string;
  meeting_url?: string | null;
  video_asset_id?: string | null;
  video_duration_seconds?: number | null;
  scheduled_times?: string[] | any;
  timezone?: string;
  repeat_type?: RepeatType;
  repeat_interval_hours?: number | null;
  repeat_end_date?: string | null;
  replay_enabled?: boolean;
  replay_delay_minutes?: number;
  replay_expires_hours?: number | null;
  replay_per_slot?: boolean;
  is_published?: boolean;
  registration_required?: boolean;
  registration_fields?: { name?: boolean; phone?: boolean; email?: boolean };
  max_attendees?: number | null;
  status?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: SessionRow | null;
}

// Build slots for daily/interval previews
function buildPreviewSlots(state: WizardState): Date[] {
  const baseDate = state.firstSlotDate ?? new Date();
  const [hh, mm] = (state.firstSlotTime || "10:00").split(":").map(Number);
  const start = new Date(baseDate);
  start.setHours(hh, mm, 0, 0);

  if (state.repeatType === "once") return [start];

  if (state.repeatType === "daily") {
    const out: Date[] = [];
    const end = state.repeatEndDate ? new Date(state.repeatEndDate) : new Date(start.getTime() + 30 * 86400000);
    for (let d = new Date(start); d <= end && out.length < 100; d = new Date(d.getTime() + 86400000)) {
      out.push(new Date(d));
    }
    return out;
  }

  if (state.repeatType === "interval") {
    const out: Date[] = [];
    const intervalH = state.intervalHours;
    const [eh, em] = (state.intervalEndTime || "20:00").split(":").map(Number);
    const lastDate = state.repeatEndDate ? new Date(state.repeatEndDate) : start;
    for (let day = new Date(start); day <= lastDate || out.length === 0; day = new Date(day.getTime() + 86400000)) {
      const dayStart = new Date(day);
      dayStart.setHours(hh, mm, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(eh, em, 0, 0);
      for (let t = new Date(dayStart); t <= dayEnd && out.length < 200; t = new Date(t.getTime() + intervalH * 3600000)) {
        out.push(new Date(t));
      }
      if (!state.repeatEndDate) break;
    }
    return out;
  }

  // custom
  return state.customSlots
    .filter((s) => s.date && s.time)
    .map((s) => {
      const [h, m] = s.time.split(":").map(Number);
      const d = new Date(s.date!);
      d.setHours(h, m, 0, 0);
      return d;
    });
}

interface WizardState {
  step: number;
  // Step 1
  sessionType: "funnel_video" | "external_link";
  // Step 2
  title: string;
  description: string;
  videoAssetId: string | null;
  videoTitle: string;
  videoDuration: number; // seconds
  meetingUrl: string;
  externalPlatform: string;
  accessType: "public" | "registration" | "paid";
  // Step 3
  firstSlotDate: Date | null;
  firstSlotTime: string;
  repeatType: RepeatType;
  intervalHours: number;
  intervalEndTime: string;
  repeatEndDate: Date | null;
  customSlots: { date: Date | null; time: string }[];
  // Step 4
  replayEnabled: boolean;
  replayDelayMinutes: number;
  replayExpiresHours: number | null; // null = forever
  replayPerSlot: boolean;
  isPublished: boolean;
  registrationRequired: boolean;
  regFields: { name: boolean; phone: boolean; email: boolean };
  maxAttendees: number | null;
  sendConfirmationEmail: boolean;
  sendReminderEmail: boolean;
  reminderMinutesBefore: number;
}

const initialState = (editing?: SessionRow | null): WizardState => {
  const slots: Date[] = (editing?.scheduled_times ?? [])
    .map((s: any) => new Date(s))
    .filter((d: Date) => !isNaN(d.getTime()))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
  const first = slots[0];
  return {
    step: 1,
    sessionType: editing?.session_type === "external_link" ? "external_link" : "funnel_video",
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    videoAssetId: editing?.video_asset_id ?? null,
    videoTitle: "",
    videoDuration: editing?.video_duration_seconds ?? 0,
    meetingUrl: editing?.meeting_url ?? "",
    externalPlatform: "zoom",
    accessType: editing?.registration_required ? "registration" : "public",
    firstSlotDate: first ?? new Date(),
    firstSlotTime: first ? format(first, "HH:mm") : "10:00",
    repeatType: (editing?.repeat_type as RepeatType) ?? "once",
    intervalHours: editing?.repeat_interval_hours ?? 2,
    intervalEndTime: "20:00",
    repeatEndDate: editing?.repeat_end_date ? new Date(editing.repeat_end_date) : null,
    customSlots: editing?.repeat_type === "custom"
      ? slots.map((d) => ({ date: d, time: format(d, "HH:mm") }))
      : [{ date: new Date(), time: "10:00" }],
    replayEnabled: editing?.replay_enabled ?? true,
    replayDelayMinutes: editing?.replay_delay_minutes ?? 0,
    replayExpiresHours: editing?.replay_expires_hours ?? null,
    replayPerSlot: editing?.replay_per_slot ?? true,
    isPublished: editing?.is_published ?? true,
    registrationRequired: editing?.registration_required ?? false,
    regFields: {
      name: editing?.registration_fields?.name ?? true,
      phone: editing?.registration_fields?.phone ?? false,
      email: editing?.registration_fields?.email ?? true,
    },
    maxAttendees: editing?.max_attendees ?? null,
    sendConfirmationEmail: (editing as any)?.send_confirmation_email ?? true,
    sendReminderEmail: (editing as any)?.send_reminder_email ?? true,
    reminderMinutesBefore: (editing as any)?.reminder_minutes_before ?? 15,
  };
};

export const LiveSessionWizard = ({ open, onClose, editing }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [s, setS] = useState<WizardState>(initialState(editing));
  const [pickerOpen, setPickerOpen] = useState(false);
  const isEdit = !!editing?.id;
  const isLive = editing?.status === "live";

  useEffect(() => {
    if (open) setS(initialState(editing));
  }, [open, editing]);

  const upd = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setS((p) => ({ ...p, [k]: v }));

  const previewSlots = useMemo(() => buildPreviewSlots(s).slice(0, 12), [s]);

  const canNext = (): boolean => {
    if (s.step === 1) return true;
    if (s.step === 2) {
      if (!s.title.trim()) return false;
      if (s.sessionType === "funnel_video") return !!s.videoAssetId;
      return !!s.meetingUrl.trim();
    }
    if (s.step === 3) {
      if (s.repeatType === "custom") return s.customSlots.some((c) => c.date && c.time);
      return !!s.firstSlotDate && !!s.firstSlotTime;
    }
    return true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slots = buildPreviewSlots(s).map((d) => d.toISOString());
      if (slots.length === 0) throw new Error("Add at least one scheduled time");

      const payload: any = {
        owner_id: user!.id,
        title: s.title.trim(),
        description: s.description || null,
        session_type: s.sessionType,
        video_asset_id: s.sessionType === "funnel_video" ? s.videoAssetId : null,
        video_duration_seconds: s.sessionType === "funnel_video" ? s.videoDuration : 0,
        meeting_url: s.sessionType === "external_link" ? s.meetingUrl : null,
        scheduled_times: slots,
        scheduled_at: slots[0],
        timezone: "Asia/Kolkata",
        repeat_type: s.repeatType,
        repeat_interval_hours: s.repeatType === "interval" ? s.intervalHours : null,
        repeat_end_date: s.repeatEndDate ? format(s.repeatEndDate, "yyyy-MM-dd") : null,
        replay_enabled: s.replayEnabled,
        replay_delay_minutes: s.replayDelayMinutes,
        replay_expires_hours: s.replayExpiresHours,
        replay_per_slot: s.replayPerSlot,
        is_published: s.isPublished,
        registration_required: s.registrationRequired,
        registration_fields: s.regFields,
        max_attendees: s.maxAttendees,
        send_confirmation_email: s.sendConfirmationEmail,
        send_reminder_email: s.sendReminderEmail,
        reminder_minutes_before: s.reminderMinutesBefore,
        status: isEdit ? editing?.status : (s.isPublished ? "scheduled" : "draft"),
      };

      if (isEdit) {
        const { error } = await supabase.from("live_sessions").update(payload).eq("id", editing!.id!);
        if (error) throw error;
      } else {
        payload.slug = generateSlug(s.title) + "-" + Date.now().toString(36);
        const { error } = await supabase.from("live_sessions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Session updated" : "Session scheduled");
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["live-session"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? "Edit Live Session" : "New Live Session"}
            <span className="text-xs font-normal text-muted-foreground ml-2">Step {s.step} of 4</span>
          </DialogTitle>
        </DialogHeader>

        {isLive && (
          <Card className="p-3 border-amber-500/30 bg-amber-500/5 flex gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs">
              This session is currently live. Changes will only affect future scheduled slots.
            </p>
          </Card>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= s.step ? "bg-primary" : "bg-muted",
            )} />
          ))}
        </div>

        {/* STEP 1 — Type */}
        {s.step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">What kind of session?</h3>
            <button
              onClick={() => upd("sessionType", "funnel_video")}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all flex gap-3",
                s.sessionType === "funnel_video" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
              )}
            >
              <Video className="text-primary shrink-0" size={24} />
              <div className="flex-1">
                <p className="font-semibold text-sm">Use Existing Video</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pick a video already in Smart Income Program. It plays automatically at your scheduled times.
                </p>
              </div>
              {s.sessionType === "funnel_video" && <Check className="text-primary shrink-0" size={18} />}
            </button>

            <button
              onClick={() => upd("sessionType", "external_link")}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all flex gap-3",
                s.sessionType === "external_link" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
              )}
            >
              <LinkIcon className="text-primary shrink-0" size={24} />
              <div className="flex-1">
                <p className="font-semibold text-sm">External Meeting Link</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Zoom, Google Meet, or any live meeting link.
                </p>
              </div>
              {s.sessionType === "external_link" && <Check className="text-primary shrink-0" size={18} />}
            </button>
          </div>
        )}

        {/* STEP 2 — Source */}
        {s.step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Session Title *</Label>
              <Input value={s.title} onChange={(e) => upd("title", e.target.value)} placeholder="e.g. Weekly Training" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={s.description} onChange={(e) => upd("description", e.target.value)} rows={2} className="mt-1" />
            </div>

            {s.sessionType === "funnel_video" ? (
              <div>
                <Label className="text-xs">Video *</Label>
                <Button variant="outline" className="mt-1 w-full justify-start" onClick={() => setPickerOpen(true)}>
                  <Video size={14} />
                  {s.videoAssetId ? (s.videoTitle || "Video selected") : "Select a video…"}
                </Button>
                {s.videoDuration > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Duration: {Math.floor(s.videoDuration / 60)}m {s.videoDuration % 60}s
                  </p>
                )}
                <VideoPickerModal
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onSelect={async (videoId, title) => {
                    setPickerOpen(false);
                    upd("videoAssetId", videoId);
                    setS((p) => ({ ...p, videoTitle: title }));
                    const { data } = await supabase.from("video_assets").select("duration_seconds").eq("id", videoId).maybeSingle();
                    if (data?.duration_seconds) upd("videoDuration", data.duration_seconds);
                  }}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Platform</Label>
                  <Select value={s.externalPlatform} onValueChange={(v) => upd("externalPlatform", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="google_meet">Google Meet</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Meeting URL *</Label>
                  <Input value={s.meetingUrl} onChange={(e) => upd("meetingUrl", e.target.value)} placeholder="https://zoom.us/j/…" className="mt-1" />
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3 — Schedule */}
        {s.step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">When should this session play?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                All scheduled times use the same link. Viewers who miss one slot can wait for the next one.
              </p>
            </div>

            {/* Date + Time */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">First date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="mt-1 w-full justify-start font-normal">
                      <CalIcon size={14} />
                      {s.firstSlotDate ? format(s.firstSlotDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={s.firstSlotDate ?? undefined} onSelect={(d) => upd("firstSlotDate", d ?? null)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Time (IST)</Label>
                <Input type="time" value={s.firstSlotTime} onChange={(e) => upd("firstSlotTime", e.target.value)} className="mt-1" step={1800} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Timezone: IST (Asia/Kolkata)</p>

            {/* Repeat options */}
            <div className="space-y-2">
              {[
                { v: "once", label: "Play Once", sub: "1 session • 1 link", desc: "Plays one time at your scheduled date and time" },
                { v: "daily", label: "Repeat Daily", sub: "Same time every day • Same link", desc: "Plays every day at the same time" },
                { v: "interval", label: "Repeat Every Few Hours", sub: "Multiple sessions per day • Same link", desc: "Plays multiple times per day" },
                { v: "custom", label: "Custom Schedule", sub: "Pick specific dates and times", desc: "Add specific dates and times manually" },
              ].map((opt) => (
                <button key={opt.v} onClick={() => upd("repeatType", opt.v as RepeatType)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border-2 transition-all",
                    s.repeatType === opt.v ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
                  )}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{opt.label}</p>
                    {s.repeatType === opt.v && <Check size={16} className="text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>

            {/* Sub-options per type */}
            {s.repeatType === "daily" && (
              <div className="p-3 bg-muted/40 rounded-xl">
                <Label className="text-xs">Stop repeating after (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="mt-1 w-full justify-start font-normal">
                      <CalIcon size={14} />
                      {s.repeatEndDate ? format(s.repeatEndDate, "PPP") : "No end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={s.repeatEndDate ?? undefined} onSelect={(d) => upd("repeatEndDate", d ?? null)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {s.repeatType === "interval" && (
              <div className="p-3 bg-muted/40 rounded-xl space-y-3">
                <div>
                  <Label className="text-xs">Every</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[2, 3, 4, 6, 8, 12].map((h) => (
                      <button key={h} onClick={() => upd("intervalHours", h)}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-full border",
                          s.intervalHours === h ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border",
                        )}>
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">From (start)</Label>
                    <Input type="time" value={s.firstSlotTime} onChange={(e) => upd("firstSlotTime", e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Until</Label>
                    <Input type="time" value={s.intervalEndTime} onChange={(e) => upd("intervalEndTime", e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Stop after (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="mt-1 w-full justify-start font-normal">
                        <CalIcon size={14} />
                        {s.repeatEndDate ? format(s.repeatEndDate, "PPP") : "No end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={s.repeatEndDate ?? undefined} onSelect={(d) => upd("repeatEndDate", d ?? null)} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {s.repeatType === "custom" && (
              <div className="p-3 bg-muted/40 rounded-xl space-y-2">
                {s.customSlots.map((slot, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-[10px]">Session {i + 1}</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="mt-1 w-full justify-start font-normal">
                            <CalIcon size={12} />
                            {slot.date ? format(slot.date, "MMM d, yyyy") : "Date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={slot.date ?? undefined} onSelect={(d) => {
                            const next = [...s.customSlots]; next[i] = { ...next[i], date: d ?? null }; upd("customSlots", next);
                          }} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input type="time" value={slot.time} onChange={(e) => {
                      const next = [...s.customSlots]; next[i] = { ...next[i], time: e.target.value }; upd("customSlots", next);
                    }} className="w-28" />
                    <Button variant="ghost" size="icon" onClick={() => upd("customSlots", s.customSlots.filter((_, j) => j !== i))} className="h-9 w-9">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {s.customSlots.length < 20 && (
                  <Button variant="outline" size="sm" onClick={() => upd("customSlots", [...s.customSlots, { date: new Date(), time: "10:00" }])}>
                    <Plus size={12} /> Add another time
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  ℹ️ All sessions above share the same public link. Viewers join whichever session is currently live.
                </p>
              </div>
            )}

            {/* Live preview */}
            {previewSlots.length > 0 && (
              <Card className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Sessions with this link</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewSlots.map((d, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                      ▶ {format(d, "MMM d, h:mm a")}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* STEP 4 — Settings */}
        {s.step === 4 && (
          <div className="space-y-4">
            {/* Replay */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Allow viewers to rewatch this session</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {s.replayEnabled
                      ? "Viewers can watch a recording after each live session ends"
                      : "Viewers must join during the live session. No recording will be available."}
                  </p>
                </div>
                <Switch checked={s.replayEnabled} onCheckedChange={(v) => upd("replayEnabled", v)} />
              </div>

              {!s.replayEnabled && (
                <Card className="p-3 border-amber-500/30 bg-amber-500/5 text-[11px]">
                  ℹ️ Replay is off. Viewers who miss a session will see a countdown to your next scheduled slot (if any).
                </Card>
              )}

              {s.replayEnabled && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <div>
                    <Label className="text-xs">When should replay become available?</Label>
                    <Select value={String(s.replayDelayMinutes)} onValueChange={(v) => upd("replayDelayMinutes", parseInt(v))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Immediately</SelectItem>
                        <SelectItem value="30">After 30 minutes</SelectItem>
                        <SelectItem value="60">After 1 hour</SelectItem>
                        <SelectItem value="1440">After 24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">How long should replay stay available?</Label>
                    <Select value={s.replayExpiresHours == null ? "forever" : String(s.replayExpiresHours)} onValueChange={(v) => upd("replayExpiresHours", v === "forever" ? null : parseInt(v))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="forever">Forever</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                        <SelectItem value="168">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {s.repeatType !== "once" && (
                    <div>
                      <Label className="text-xs">For repeat sessions</Label>
                      <div className="space-y-1 mt-1">
                        <button onClick={() => upd("replayPerSlot", true)} className={cn("w-full text-left text-xs p-2 rounded-lg border", s.replayPerSlot ? "border-primary bg-primary/5" : "border-border")}>
                          Show replay after EACH slot ends
                        </button>
                        <button onClick={() => upd("replayPerSlot", false)} className={cn("w-full text-left text-xs p-2 rounded-lg border", !s.replayPerSlot ? "border-primary bg-primary/5" : "border-border")}>
                          Show replay only after ALL slots end
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Publish */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Publish this session</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {s.isPublished ? "Link is active for viewers" : 'Link shows "Not available" to viewers'}
                  </p>
                </div>
                <Switch checked={s.isPublished} onCheckedChange={(v) => upd("isPublished", v)} />
              </div>
            </Card>

            {/* Registration */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Require Registration</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Viewers must register before watching</p>
                </div>
                <Switch checked={s.registrationRequired} onCheckedChange={(v) => upd("registrationRequired", v)} />
              </div>
              {s.registrationRequired && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                  {(["name", "email", "phone"] as const).map((f) => (
                    <label key={f} className="flex items-center gap-2 text-xs capitalize">
                      <input type="checkbox" checked={s.regFields[f]} onChange={(e) => upd("regFields", { ...s.regFields, [f]: e.target.checked })} />
                      {f}
                    </label>
                  ))}
                </div>
              )}
              <div>
                <Label className="text-xs">Max viewers per session (optional)</Label>
                <Input type="number" value={s.maxAttendees ?? ""} onChange={(e) => upd("maxAttendees", e.target.value ? parseInt(e.target.value) : null)} placeholder="Unlimited" className="mt-1" />
              </div>
            </Card>

            {/* Email reminders */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Send confirmation email</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Sent immediately after a viewer registers</p>
                </div>
                <Switch checked={s.sendConfirmationEmail} onCheckedChange={(v) => upd("sendConfirmationEmail", v)} />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <Label className="text-sm font-semibold">Send reminder before each slot</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Auto-emails registrants before the session starts</p>
                </div>
                <Switch checked={s.sendReminderEmail} onCheckedChange={(v) => upd("sendReminderEmail", v)} />
              </div>
              {s.sendReminderEmail && (
                <div>
                  <Label className="text-xs">Reminder lead time (minutes before)</Label>
                  <Input type="number" min={5} max={120} value={s.reminderMinutesBefore} onChange={(e) => upd("reminderMinutesBefore", parseInt(e.target.value) || 15)} className="mt-1" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Emails are sent only when registration is enabled and the viewer provided an email.</p>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button variant="ghost" onClick={s.step === 1 ? onClose : () => upd("step", s.step - 1)}>
            {s.step === 1 ? <X size={14} /> : <ChevronLeft size={14} />}
            {s.step === 1 ? "Cancel" : "Back"}
          </Button>
          {s.step < 4 ? (
            <Button variant="hero" onClick={() => upd("step", s.step + 1)} disabled={!canNext()}>
              Next <ChevronRight size={14} />
            </Button>
          ) : (
            <Button variant="hero" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Schedule Session"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
