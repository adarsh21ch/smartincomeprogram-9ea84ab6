import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Video, Settings, ClipboardList, Mic, MessageCircle, IndianRupee,
  Radio, Rocket, Check, Copy, Plus, Trash2, GripVertical, Lock, ExternalLink,
  Play, CreditCard, UserCheck, Calendar, Layers, ChevronDown, ChevronUp, Pencil,
  User, ListChecks, X
} from "lucide-react";
import { VideoPickerModal } from "@/components/VideoPickerModal";
import { StepTypeSelector, getStepTypeMeta } from "@/components/funnel/StepTypeSelector";
import { StepConfigPanel } from "@/components/funnel/StepConfigPanel";
import { JourneyPreview } from "@/components/funnel/JourneyPreview";
import { PrivacySettings } from "@/components/funnel/PrivacySettings";
import { FunnelLivePreview } from "@/components/funnel/FunnelLivePreview";
import { SpeakerPhotoUpload } from "@/components/funnel/SpeakerPhotoUpload";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePlan } from "@/hooks/usePlan";
import { Crown } from "lucide-react";

interface FlowStep {
  id?: string;
  step_order: number;
  title: string;
  description: string;
  step_type: string;
  video_asset_id: string | null;
  is_active: boolean;
  unlock_rule_type: string;
  unlock_rule_value: string;
  cta_text: string;
  cta_url: string;
  booking_url: string;
  unlock_timer_minutes?: number;
  between_step_audio_url?: string;
  between_step_audio_enabled?: boolean;
  between_step_message?: string;
  between_step_message_enabled?: boolean;
  unlock_after_percent?: number;
  // New per-step fields
  unlock_condition?: string;
  unlock_percentage?: number;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  speaker_mode_step?: string;
  speaker_name_custom?: string;
  speaker_title?: string;
  speaker_bio?: string;
  speaker_photo_url_custom?: string;
  video_topics_step_enabled?: boolean;
  video_topics_step?: Array<{ icon: string; text: string }>;
}

const createEmptyStep = (order: number, type: string = "video"): FlowStep => ({
  step_order: order,
  title: "",
  description: "",
  step_type: type,
  video_asset_id: null,
  is_active: true,
  unlock_rule_type: order === 0 ? "auto" : "watch_complete",
  unlock_rule_value: "",
  cta_text: "",
  cta_url: "",
  booking_url: "",
});

const generateSlug = (title: string) => {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "my-funnel";
  return `${base}-${Date.now().toString(36)}`;
};

// ── Wizard step definitions per mode ──
const SINGLE_STEPS = [
  { icon: FileText, label: "Name & Info", num: "1" },
  { icon: Video, label: "Video", num: "2" },
  { icon: Settings, label: "Video Settings", num: "3" },
  { icon: User, label: "Speaker", num: "4" },
  { icon: ListChecks, label: "Video Topics", num: "5" },
  { icon: ClipboardList, label: "Lead Capture", num: "6" },
  { icon: MessageCircle, label: "Contact Info", num: "7" },
  { icon: IndianRupee, label: "Payment", num: "8" },
  { icon: Lock, label: "Privacy", num: "9" },
  { icon: Rocket, label: "Publish", num: "10" },
];

const MULTI_STEPS = [
  { icon: FileText, label: "Name & Info", num: "1" },
  { icon: Layers, label: "Build Journey", num: "2" },
  { icon: Settings, label: "Video Settings", num: "3" },
  { icon: User, label: "Speaker", num: "4" },
  { icon: ListChecks, label: "Video Topics", num: "5" },
  { icon: MessageCircle, label: "Contact Info", num: "6" },
  { icon: Lock, label: "Privacy", num: "7" },
  { icon: Rocket, label: "Publish", num: "8" },
];

const UNLOCK_LABELS: Record<string, string> = {
  auto: "Auto",
  watch_complete: "Full watch",
  watch_seconds: "Watch seconds",
  watch_percent: "Watch %",
  cta_click: "CTA click",
  lead_submitted: "Form submit",
  payment_submitted: "Payment",
  manual: "Manual",
  booking_done: "Booking done",
};

const FunnelEditor = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canUseMultiStep } = usePlan();
  const queryClient = useQueryClient();

  // Wizard state — modeChosen gates entry into the real wizard
  const [wizardStep, setWizardStep] = useState(0);
  const [modeChosen, setModeChosen] = useState(isEdit);

  // Video picker
  const searchParams = new URLSearchParams(window.location.search);
  const preselectedVideoId = searchParams.get("videoId");
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [stepVideoPickerIdx, setStepVideoPickerIdx] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string; url: string | null; thumbnail?: string | null } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step type selector & config panel
  const [stepTypeSelectorOpen, setStepTypeSelectorOpen] = useState(false);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);

  // Journey preview collapsible (mobile)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [audioNoteEnabled, setAudioNoteEnabled] = useState(false);

  const [funnel, setFunnel] = useState({
    title: "", slug: "", description: "", visibility: "public", intent_type: "lead",
    funnel_mode: "single" as "single" | "multi",
    allow_seek: false, allow_speed_change: true, lock_cta: false,
    cta_enabled: true, cta_text: "Get Started", cta_timing_seconds: 60, cta_url: "",
    video_access_minutes: null as number | null,
    show_contact_buttons: false, contact_whatsapp: "", contact_phone: "", contact_instagram: "",
    show_contact_after_cta: true, whatsapp_auto_message: false, whatsapp_message_template: "Hi {name}, thanks for watching!",
    audio_note_url: "", audio_note_timing: "before", audio_note_autoplay: false, audio_lock_video: false,
    payment_enabled: false, upi_id: "", qr_code_url: "", payment_instructions: "",
    is_live_broadcast: false, broadcast_scheduled_at: "", broadcast_password: "", broadcast_replay_enabled: true,
    is_published: false,
    access_code_plain: "",
    required_fields: { email: false, city: false, state: false, whatsapp: false } as { email: boolean; city: boolean; state: boolean; whatsapp: boolean },
    speaker_mode: "account" as "none" | "account" | "custom",
    speaker_name: "", speaker_photo_url: "", speaker_about: "",
    video_topics_enabled: false,
    video_topics: [] as string[],
    speaker_scope: "global" as "global" | "per_step",
    video_topics_scope: "global" as "global" | "per_step",
  });

  const [leadForm, setLeadForm] = useState({
    capture_enabled: true, capture_timing: "before_video",
    show_name: true, name_required: true, show_phone: true, phone_required: true,
    show_email: false, email_required: false, show_city: true, city_required: false,
    custom_field_label: "", show_custom: false, custom_required: false,
  });

  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);

  // ── Queries ──
  const { data: userProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => { if (!user) return null; const { data } = await supabase.from("profiles").select("full_name, avatar_url, bio").eq("id", user.id).single(); return data; },
    enabled: !!user,
  });
  const { data: existingFunnel } = useQuery({
    queryKey: ["funnel", id],
    queryFn: async () => { if (!id) return null; const { data } = await supabase.from("funnels").select("*").eq("id", id).single(); return data; },
    enabled: isEdit,
  });
  const { data: existingLeadForm } = useQuery({
    queryKey: ["funnel-lead-form", id],
    queryFn: async () => { if (!id) return null; const { data } = await supabase.from("funnel_lead_form_config").select("*").eq("funnel_id", id).single(); return data; },
    enabled: isEdit,
  });
  const { data: existingSteps } = useQuery({
    queryKey: ["funnel-steps", id],
    queryFn: async () => { if (!id) return []; const { data } = await supabase.from("funnel_steps").select("*").eq("funnel_id", id).order("step_order"); return data || []; },
    enabled: isEdit,
  });

  // ── Hydrate from existing ──
  useEffect(() => {
    if (existingFunnel) {
      const f = existingFunnel;
      setFunnel((prev) => ({
        ...prev,
        title: f.title || "", slug: f.slug || "", description: f.description || "",
        visibility: f.visibility || "public", intent_type: f.intent_type || "lead",
        funnel_mode: (f as any).funnel_mode || "single",
        allow_seek: f.allow_seek || false, allow_speed_change: f.allow_speed_change ?? true,
        lock_cta: f.lock_cta || false, cta_enabled: (f as any).cta_enabled ?? true,
        cta_text: f.cta_text || "Get Started", cta_timing_seconds: f.cta_timing_seconds || 60,
        cta_url: f.cta_url || "", video_access_minutes: f.video_access_minutes || null,
        show_contact_buttons: f.show_contact_buttons || false,
        contact_whatsapp: f.contact_whatsapp || "", contact_phone: f.contact_phone || "",
        contact_instagram: f.contact_instagram || "", show_contact_after_cta: f.show_contact_after_cta ?? true,
        whatsapp_auto_message: f.whatsapp_auto_message || false,
        whatsapp_message_template: f.whatsapp_message_template || "Hi {name}, thanks for watching!",
        payment_enabled: f.payment_enabled || false, upi_id: f.upi_id || "",
        qr_code_url: f.qr_code_url || "", payment_instructions: f.payment_instructions || "",
        is_live_broadcast: f.is_live_broadcast || false,
        broadcast_scheduled_at: f.broadcast_scheduled_at || "", broadcast_password: f.broadcast_password || "",
        broadcast_replay_enabled: f.broadcast_replay_enabled ?? true,
        is_published: f.is_published || false,
        access_code_plain: (f as any).access_code_plain || "",
        required_fields: (f as any).required_fields || { email: false, city: false, state: false, whatsapp: false },
        speaker_mode: (f as any).speaker_mode || "account",
        speaker_name: (f as any).speaker_name || "",
        speaker_photo_url: (f as any).speaker_photo_url || "",
        speaker_about: (f as any).speaker_about || "",
        video_topics_enabled: (f as any).video_topics_enabled ?? false,
        video_topics: Array.isArray((f as any).video_topics) ? (f as any).video_topics : [],
        speaker_scope: (f as any).speaker_scope || "global",
        video_topics_scope: (f as any).video_topics_scope || "global",
      }));
      setModeChosen(true);
      if (f.audio_note_url) setAudioNoteEnabled(true);
      if (f.video_asset_id) {
        supabase.from("video_assets").select("id, title, public_url, thumbnail_url").eq("id", f.video_asset_id).single().then(({ data }) => {
          if (data) setSelectedVideo({ id: data.id, title: data.title, url: data.public_url, thumbnail: data.thumbnail_url });
        });
      }
    }
  }, [existingFunnel]);

  useEffect(() => {
    if (existingLeadForm) {
      const l = existingLeadForm;
      setLeadForm({
        capture_enabled: l.capture_enabled ?? true, capture_timing: l.capture_timing || "before_video",
        show_name: l.show_name ?? true, name_required: l.name_required ?? true,
        show_phone: l.show_phone ?? true, phone_required: l.phone_required ?? true,
        show_email: l.show_email ?? false, email_required: l.email_required ?? false,
        show_city: l.show_city ?? true, city_required: l.city_required ?? false,
        custom_field_label: l.custom_field_label || "", show_custom: l.show_custom ?? false,
        custom_required: l.custom_required ?? false,
      });
    }
  }, [existingLeadForm]);

  useEffect(() => {
    if (existingSteps && existingSteps.length > 0) {
      setFlowSteps(existingSteps.map((s: any) => ({
        id: s.id, step_order: s.step_order, title: s.title || "", description: s.description || "",
        step_type: s.step_type || "video", video_asset_id: s.video_asset_id, is_active: s.is_active ?? true,
        unlock_rule_type: s.unlock_rule_type || "auto", unlock_rule_value: s.unlock_rule_value || "",
        cta_text: s.cta_text || "", cta_url: s.cta_url || "", booking_url: s.booking_url || "",
        unlock_condition: s.unlock_condition || "full_watch",
        unlock_percentage: s.unlock_percentage ?? 80,
        time_delay_enabled: s.time_delay_enabled ?? false,
        time_delay_minutes: s.time_delay_minutes ?? 0,
        speaker_mode_step: s.speaker_mode_step || "none",
        speaker_name_custom: s.speaker_name_custom || "",
        speaker_title: s.speaker_title || "",
        speaker_bio: s.speaker_bio || "",
        speaker_photo_url_custom: s.speaker_photo_url_custom || "",
        video_topics_step_enabled: s.video_topics_step_enabled ?? false,
        video_topics_step: Array.isArray(s.video_topics_step) ? s.video_topics_step : [],
      })));
    }
  }, [existingSteps]);

  useEffect(() => {
    if (preselectedVideoId && !isEdit && !selectedVideo) {
      supabase.from("video_assets").select("id, title, public_url, thumbnail_url").eq("id", preselectedVideoId).single().then(({ data }) => {
        if (data) setSelectedVideo({ id: data.id, title: data.title, url: data.public_url, thumbnail: data.thumbnail_url });
      });
    }
  }, [preselectedVideoId, isEdit, selectedVideo]);

  // ── Build & Save ──
  const update = (key: string, value: any) => setFunnel((p) => ({ ...p, [key]: value }));
  const isMulti = funnel.funnel_mode === "multi";

  const buildPayload = useCallback(() => {
    if (!user) return null;
    const slug = funnel.slug || generateSlug(funnel.title);
    return {
      owner_id: user.id, title: funnel.title, slug, description: funnel.description,
      visibility: funnel.visibility, intent_type: funnel.intent_type, funnel_mode: funnel.funnel_mode,
      allow_seek: funnel.allow_seek, allow_speed_change: funnel.allow_speed_change,
      lock_cta: funnel.lock_cta, cta_enabled: funnel.cta_enabled,
      cta_text: funnel.cta_text, cta_timing_seconds: funnel.cta_timing_seconds,
      cta_url: funnel.cta_url || null, video_access_minutes: funnel.video_access_minutes,
      show_contact_buttons: funnel.show_contact_buttons,
      contact_whatsapp: funnel.contact_whatsapp || null, contact_phone: funnel.contact_phone || null,
      contact_instagram: funnel.contact_instagram || null, show_contact_after_cta: funnel.show_contact_after_cta,
      whatsapp_auto_message: funnel.whatsapp_auto_message,
      whatsapp_message_template: funnel.whatsapp_message_template || null,
      payment_enabled: funnel.payment_enabled, upi_id: funnel.upi_id || null,
      qr_code_url: funnel.qr_code_url || null, payment_instructions: funnel.payment_instructions || null,
      is_live_broadcast: funnel.is_live_broadcast, broadcast_scheduled_at: funnel.broadcast_scheduled_at || null,
      broadcast_password: funnel.broadcast_password || null, broadcast_replay_enabled: funnel.broadcast_replay_enabled,
      is_published: funnel.is_published, video_asset_id: selectedVideo?.id || null,
      access_code_plain: funnel.access_code_plain || null,
      required_fields: funnel.required_fields,
      speaker_mode: funnel.speaker_mode,
      speaker_name: funnel.speaker_name || null,
      speaker_photo_url: funnel.speaker_photo_url || null,
      speaker_about: funnel.speaker_about || null,
      video_topics_enabled: funnel.video_topics_enabled,
      video_topics: funnel.video_topics.filter((t: string) => t.trim() !== ""),
      speaker_scope: funnel.speaker_scope,
      video_topics_scope: funnel.video_topics_scope,
    };
  }, [user, funnel, selectedVideo]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (!payload) throw new Error("Not authenticated");
      let funnelId: string;
      if (isEdit) {
        const { error } = await supabase.from("funnels").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("funnel_lead_form_config").upsert({ funnel_id: id, ...leadForm }, { onConflict: "funnel_id" });
        funnelId = id!;
      } else {
        const { data, error } = await supabase.from("funnels").insert(payload).select("id").single();
        if (error) throw error;
        await supabase.from("funnel_lead_form_config").insert({ funnel_id: data.id, ...leadForm });
        funnelId = data.id;
      }
      if (funnel.funnel_mode === "multi" && flowSteps.length > 0) {
        await supabase.from("funnel_steps").delete().eq("funnel_id", funnelId);
        const stepsPayload = flowSteps.map((s, i) => ({
          funnel_id: funnelId, step_order: i, title: s.title, description: s.description || null,
          step_type: s.step_type, video_asset_id: s.video_asset_id || null, is_active: s.is_active,
          unlock_rule_type: s.unlock_rule_type, unlock_rule_value: s.unlock_rule_value || null,
          cta_text: s.cta_text || null, cta_url: s.cta_url || null, booking_url: s.booking_url || null,
          unlock_condition: s.unlock_condition || "full_watch",
          unlock_percentage: s.unlock_percentage ?? 80,
          time_delay_enabled: s.time_delay_enabled ?? false,
          time_delay_minutes: s.time_delay_minutes ?? 0,
          speaker_mode_step: s.speaker_mode_step || "none",
          speaker_name_custom: s.speaker_name_custom || null,
          speaker_title: s.speaker_title || null,
          speaker_bio: s.speaker_bio || null,
          speaker_photo_url_custom: s.speaker_photo_url_custom || null,
          video_topics_step_enabled: s.video_topics_step_enabled ?? false,
          video_topics_step: s.video_topics_step || [],
        }));
        const { error: stepErr } = await supabase.from("funnel_steps").insert(stepsPayload);
        if (stepErr) throw stepErr;
      }
      return funnelId;
    },
    onSuccess: (funnelId) => {
      queryClient.invalidateQueries({ queryKey: ["my-funnels"] });
      queryClient.invalidateQueries({ queryKey: ["funnel-steps", id] });
      setLastSavedAt(new Date());
      toast.success(isEdit ? "Funnel updated!" : "Funnel created!");
      navigate(`/funnels/${funnelId}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  // Auto-save
  useEffect(() => {
    if (!isEdit || !id) return;
    autoSaveTimer.current = setInterval(async () => {
      const payload = buildPayload();
      if (!payload || !payload.title) return;
      try {
        await supabase.from("funnels").update(payload).eq("id", id);
        await supabase.from("funnel_lead_form_config").upsert({ funnel_id: id, ...leadForm }, { onConflict: "funnel_id" });
        setLastSavedAt(new Date());
      } catch {}
    }, 30000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [isEdit, id, buildPayload, leadForm]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Flow step helpers ──
  const addFlowStep = (type: string) => {
    const newStep = createEmptyStep(flowSteps.length, type);
    setFlowSteps((prev) => [...prev, newStep]);
    setEditingStepIdx(flowSteps.length);
  };

  const updateFlowStep = (index: number, key: keyof FlowStep, value: any) => {
    setFlowSteps((prev) => prev.map((s, i) => i === index ? { ...s, [key]: value } : s));
  };

  const removeFlowStep = (index: number) => {
    setFlowSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i })));
    if (editingStepIdx === index) setEditingStepIdx(null);
  };

  const duplicateStep = (index: number) => {
    const original = flowSteps[index];
    const newStep = { ...original, id: undefined, title: `${original.title} (copy)`, step_order: flowSteps.length };
    setFlowSteps((prev) => [...prev, newStep]);
  };

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= flowSteps.length) return;
    setFlowSteps((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr.map((s, i) => ({ ...s, step_order: i }));
    });
  };

  // ── Wizard steps for current mode ──
  const visibleSteps = isMulti ? MULTI_STEPS : SINGLE_STEPS;
  const totalSteps = visibleSteps.length;
  const lastStepIdx = totalSteps - 1;

  // visibleSteps & nav computed

  // ── Render helper for common steps ──
  // Single: 0=Controls, 1=Speaker, 2=VideoTopics, 3=LeadForm, 4=Whatsapp, 5=Payment, 6=Privacy, 7=Publish
  // Multi:  0=Controls, 1=Speaker, 2=VideoTopics, 3=Whatsapp, 4=Privacy, 5=Publish (Payment hidden)
  const renderCommonStep = (offset: number) => {
    const idx = wizardStep - offset;
    if (idx === 0) return renderControlsStep();
    if (idx === 1) return renderSpeakerStep();
    if (idx === 2) return renderVideoTopicsStep();
    if (!isMulti && idx === 3) return renderLeadFormStep();
    const whatsappIdx = isMulti ? 3 : 4;
    const paymentIdx = isMulti ? -1 : 5; // Payment hidden for multi
    const privacyIdx = isMulti ? 4 : 6;
    const publishIdx = isMulti ? 5 : 7;
    if (idx === whatsappIdx) return renderWhatsappStep();
    if (idx === paymentIdx) return renderPaymentStep();
    if (idx === privacyIdx) return renderPrivacyStep();
    if (idx === publishIdx) return renderPublishStep();
    return null;
  };

  // ── Step renderers ──
  const renderBasicInfo = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Basic Info</h2>
      <p className="text-sm text-muted-foreground">Give your funnel a name and description.</p>
      <div className="space-y-4 mt-4">
        <div>
          <Label>Funnel Name *</Label>
          <Input value={funnel.title} onChange={(e) => { update("title", e.target.value); if (!isEdit) update("slug", generateSlug(e.target.value)); }} className="mt-1.5 bg-muted border-border" placeholder="e.g. Free Training Funnel" />
        </div>
        <div>
          <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea value={funnel.description} onChange={(e) => update("description", e.target.value)} className="mt-1.5 bg-muted border-border" rows={3} placeholder="What is this funnel about?" />
        </div>
      </div>
    </>
  );

  const renderModePicker = () => (
    <>
      <h2 className="text-xl font-heading font-bold">Create New Funnel</h2>
      <p className="text-sm text-muted-foreground">What type of funnel do you want to build?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <button
          onClick={() => { update("funnel_mode", "single"); setModeChosen(true); setWizardStep(0); }}
          className="p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Video size={22} className="text-primary" />
          </div>
          <h3 className="font-heading font-bold text-sm group-hover:text-primary transition-colors">Single Step Funnel</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            One video with lead capture, CTA, and optional payment. Simple and effective.
          </p>
        </button>
        <button
          onClick={() => {
            update("funnel_mode", "multi");
            if (flowSteps.length === 0) setFlowSteps([createEmptyStep(0)]);
            setModeChosen(true);
            setWizardStep(0);
          }}
          className="p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 text-left transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center mb-3">
            <Layers size={22} className="text-accent-foreground" />
          </div>
          <h3 className="font-heading font-bold text-sm group-hover:text-primary transition-colors">Multi-Step Flow</h3>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            A guided journey with sequential steps, unlock rules, and progress tracking.
          </p>
        </button>
      </div>
    </>
  );

  const renderVideoStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Video</h2>
      <p className="text-sm text-muted-foreground">Select the video for your funnel.</p>
      {selectedVideo ? (
        <div className="space-y-4 mt-4">
          <div className="border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-16 h-11 bg-muted rounded-lg flex items-center justify-center shrink-0">
              <Video size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedVideo.title}</p>
              <p className="text-xs text-emerald-500 mt-0.5">✓ Selected</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setVideoPickerOpen(true)}>Change</Button>
          </div>
          {selectedVideo.url && (
            <div className="rounded-xl overflow-hidden border border-border">
              <video src={selectedVideo.url} poster={selectedVideo.thumbnail || undefined} className="w-full aspect-video object-contain bg-black" controls playsInline />
            </div>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center mt-4">
          <Video size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Choose a video from your gallery</p>
          <Button variant="hero" size="sm" onClick={() => setVideoPickerOpen(true)}>Select Video</Button>
        </div>
      )}

      {/* Audio Note — inline toggle */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
          <div>
            <Label className="font-semibold flex items-center gap-2"><Mic size={15} /> Add Audio Note</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Add a personal audio message for your prospects</p>
          </div>
          <Switch checked={audioNoteEnabled} onCheckedChange={setAudioNoteEnabled} />
        </div>
        {audioNoteEnabled && (
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <Mic size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Upload audio (MP3/WAV, max 10MB)</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl">
              <Label className="font-semibold">When to Play</Label>
              <Select value={funnel.audio_note_timing} onValueChange={(v) => update("audio_note_timing", v)}>
                <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="before">Before video starts</SelectItem>
                  <SelectItem value="after">After video ends</SelectItem>
                  <SelectItem value="at_cta">When CTA appears</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div><Label className="font-semibold">Autoplay Audio</Label><p className="text-xs text-muted-foreground mt-0.5">Play automatically when triggered</p></div>
              <Switch checked={funnel.audio_note_autoplay} onCheckedChange={(v) => update("audio_note_autoplay", v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div><Label className="font-semibold">Pause Video During Audio</Label><p className="text-xs text-muted-foreground mt-0.5">Lock video until audio completes</p></div>
              <Switch checked={funnel.audio_lock_video} onCheckedChange={(v) => update("audio_lock_video", v)} />
            </div>
          </div>
        )}
      </div>

      <VideoPickerModal open={videoPickerOpen} onClose={() => setVideoPickerOpen(false)} onSelect={(videoId, title, publicUrl, thumbnailUrl) => { setSelectedVideo({ id: videoId, title, url: publicUrl, thumbnail: thumbnailUrl }); setVideoPickerOpen(false); }} />
    </>
  );

  const renderFlowStepsBuilder = () => (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold">Build Your Journey</h2>
          <p className="text-sm text-muted-foreground">Create a step-by-step experience for your prospects.</p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_240px] lg:gap-5 mt-4">
        {/* Left: Steps list */}
        <div>
          {flowSteps.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-[14px] p-10 text-center">
              <Layers size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground mb-1">No steps yet</p>
              <p className="text-xs text-muted-foreground mb-4">Start building your journey by adding the first step.</p>
              <Button variant="hero" size="sm" onClick={() => setStepTypeSelectorOpen(true)}>
                <Plus size={14} /> Add First Step
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {flowSteps.map((fs, idx) => {
                const meta = getStepTypeMeta(fs.step_type);
                return (
                  <div
                    key={idx}
                    className="group flex flex-col gap-2.5 p-4 rounded-[14px] border border-border hover:border-primary/30 bg-card/50 transition-all"
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-3">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveStep(idx, idx - 1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"><ChevronUp size={12} /></button>
                        <button onClick={() => moveStep(idx, idx + 1)} disabled={idx === flowSteps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"><ChevronDown size={12} /></button>
                      </div>

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                        <meta.icon size={16} className={meta.color} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Step {idx + 1}</span>
                          {!fs.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>}
                        </div>
                        <p className="text-[15px] font-semibold text-foreground truncate mt-0.5">
                          {fs.title || <span className="text-muted-foreground italic">Untitled {meta.label}</span>}
                        </p>
                      </div>

                      {/* Edit button */}
                      <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setEditingStepIdx(idx)}>
                        Edit
                      </Button>
                    </div>

                    {/* Bottom row: type badge + unlock rule + new badges + actions */}
                    <div className="flex items-center justify-between pl-[52px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                          {meta.label}
                        </span>
                        {idx > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground flex items-center gap-1">
                            <Lock size={9} />
                            {fs.unlock_condition === "full_watch" ? "Full watch" :
                             fs.unlock_condition === "percentage" ? `${fs.unlock_percentage || 80}%` :
                             fs.unlock_condition === "time_spent" ? `${fs.unlock_percentage || 10} min` :
                             UNLOCK_LABELS[fs.unlock_rule_type] || "Auto"}
                          </span>
                        )}
                        {fs.time_delay_enabled && (fs.time_delay_minutes || 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 flex items-center gap-1">
                            ⏱ +{fs.time_delay_minutes} min delay
                          </span>
                        )}
                        {fs.speaker_mode_step && fs.speaker_mode_step !== "none" && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400 flex items-center gap-1">
                            👤 {fs.speaker_mode_step === "account" ? "Account" : "Custom"}
                          </span>
                        )}
                        {fs.video_topics_step_enabled && (fs.video_topics_step?.length || 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                            📋 {fs.video_topics_step?.length} topics
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => duplicateStep(idx)}>
                          <Copy size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeFlowStep(idx)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Step button */}
          {flowSteps.length > 0 && (
            <button
              onClick={() => setStepTypeSelectorOpen(true)}
              className="w-full mt-3 rounded-[14px] py-5 text-center transition-all border-2 border-dashed border-border text-muted-foreground font-semibold text-sm hover:border-primary/40 hover:text-primary hover:bg-primary/5"
            >
              <Plus size={16} className="inline mr-1.5" />
              Add Step
              <span className="block text-[11px] font-normal mt-0.5 opacity-60">Add a video, form, call booking, or payment step</span>
            </button>
          )}
        </div>

        {/* Right: Live Preview (desktop) */}
        {flowSteps.length > 0 && (
          <div className="hidden lg:block">
            <div className="sticky top-24 p-4 border border-border rounded-xl bg-card/50">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-3">Live Preview</p>
              <JourneyPreview steps={flowSteps} />
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">Prospects see this exact order.</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile journey preview */}
      {flowSteps.length > 0 && (
        <Collapsible open={previewOpen} onOpenChange={setPreviewOpen} className="lg:hidden mt-4 border border-border rounded-xl overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Journey Preview
            <ChevronDown size={14} className={`transition-transform ${previewOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="p-3 pt-0">
            <JourneyPreview steps={flowSteps} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Modals */}
      <StepTypeSelector open={stepTypeSelectorOpen} onClose={() => setStepTypeSelectorOpen(false)} onSelect={addFlowStep} />
      <StepConfigPanel
        open={editingStepIdx !== null}
        onClose={() => setEditingStepIdx(null)}
        step={editingStepIdx !== null ? flowSteps[editingStepIdx] : null}
        stepIndex={editingStepIdx ?? 0}
        totalSteps={flowSteps.length}
        onUpdate={(key, value) => { if (editingStepIdx !== null) updateFlowStep(editingStepIdx, key, value); }}
        onOpenVideoPicker={() => { setStepVideoPickerIdx(editingStepIdx); }}
      />
      <VideoPickerModal
        open={stepVideoPickerIdx !== null}
        onClose={() => setStepVideoPickerIdx(null)}
        onSelect={(videoId) => {
          if (stepVideoPickerIdx !== null) updateFlowStep(stepVideoPickerIdx, "video_asset_id", videoId);
          setStepVideoPickerIdx(null);
        }}
      />
    </>
  );

  const renderControlsStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Video Controls</h2>
      <p className="text-sm text-muted-foreground">Configure playback behavior for your viewers.</p>
      <div className="space-y-4 mt-4">
        {!isMulti && (
          <div className="p-4 bg-muted/50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Show CTA Button</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Call-to-action button on the funnel page</p>
              </div>
              <Switch checked={funnel.cta_enabled} onCheckedChange={(v) => update("cta_enabled", v)} />
            </div>
            {funnel.cta_enabled && (
              <div className="border-t border-border pt-4 space-y-3">
                <div><Label className="text-sm">Button Text</Label><Input value={funnel.cta_text} onChange={(e) => update("cta_text", e.target.value)} className="mt-1 bg-muted border-border" /></div>
                <div><Label className="text-sm">Show After (seconds)</Label><Input type="number" value={funnel.cta_timing_seconds} onChange={(e) => update("cta_timing_seconds", parseInt(e.target.value) || 0)} className="mt-1 bg-muted border-border" /></div>
                <div className="flex items-center justify-between"><Label className="text-sm">Lock Until Timer</Label><Switch checked={funnel.lock_cta} onCheckedChange={(v) => update("lock_cta", v)} /></div>
                <div><Label className="text-sm">CTA Link <span className="text-muted-foreground font-normal">(optional)</span></Label><Input value={funnel.cta_url} onChange={(e) => update("cta_url", e.target.value)} placeholder="https://..." className="mt-1 bg-muted border-border" /></div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Allow Speed Control</Label><p className="text-xs text-muted-foreground mt-0.5">Let viewers change playback speed</p></div><Switch checked={funnel.allow_speed_change} onCheckedChange={(v) => update("allow_speed_change", v)} /></div>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Allow Forward Seek</Label><p className="text-xs text-muted-foreground mt-0.5">Let viewers skip ahead in the video</p></div><Switch checked={funnel.allow_seek} onCheckedChange={(v) => update("allow_seek", v)} /></div>
        <div className="p-4 bg-muted/50 rounded-xl">
          <Label className="font-semibold">Access Time Limit</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">Auto-expire access after a set time</p>
          <Select value={funnel.video_access_minutes?.toString() || "unlimited"} onValueChange={(v) => update("video_access_minutes", v === "unlimited" ? null : parseInt(v))}>
            <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border"><SelectItem value="unlimited">No limit</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 hour</SelectItem><SelectItem value="120">2 hours</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
    </>
  );

  const renderLeadFormStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Lead Capture</h2>
      <p className="text-sm text-muted-foreground">Configure which details to collect from viewers.</p>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Enable Lead Capture</Label><p className="text-xs text-muted-foreground mt-0.5">Collect viewer information</p></div><Switch checked={leadForm.capture_enabled} onCheckedChange={(v) => setLeadForm({ ...leadForm, capture_enabled: v })} /></div>
        {leadForm.capture_enabled && (
          <>
            <div className="p-4 bg-muted/50 rounded-xl">
              <Label className="font-semibold">When to Show</Label>
              <Select value={leadForm.capture_timing} onValueChange={(v) => setLeadForm({ ...leadForm, capture_timing: v })}>
                <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border"><SelectItem value="before_video">Before Video</SelectItem><SelectItem value="after_cta">After CTA</SelectItem><SelectItem value="immediately">Immediately</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
              {[
                { key: "name", label: "Full Name" }, { key: "phone", label: "Phone Number" },
                { key: "email", label: "Email Address" }, { key: "city", label: "City" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4 p-3.5">
                  <span className="text-sm font-medium">{label}</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Show <Switch checked={(leadForm as any)[`show_${key}`]} onCheckedChange={(v) => setLeadForm({ ...leadForm, [`show_${key}`]: v })} />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Required <Switch checked={(leadForm as any)[`${key}_required`]} onCheckedChange={(v) => setLeadForm({ ...leadForm, [`${key}_required`]: v })} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><Label className="font-semibold">Custom Field</Label><Switch checked={leadForm.show_custom} onCheckedChange={(v) => setLeadForm({ ...leadForm, show_custom: v })} /></div>
            {leadForm.show_custom && <Input placeholder="Custom field label" value={leadForm.custom_field_label} onChange={(e) => setLeadForm({ ...leadForm, custom_field_label: e.target.value })} className="bg-muted border-border" />}
          </>
        )}
      </div>
    </>
  );

  const renderAudioStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Audio Note</h2>
      <p className="text-sm text-muted-foreground">Add a personal audio message for your prospects.</p>
      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center mt-4">
        <Mic size={32} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Upload audio (MP3/WAV, max 10MB)</p>
      </div>
      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl">
          <Label className="font-semibold">Audio Plays</Label>
          <Select value={funnel.audio_note_timing} onValueChange={(v) => update("audio_note_timing", v)}>
            <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border"><SelectItem value="before">Before Video</SelectItem><SelectItem value="after">After Video</SelectItem><SelectItem value="at_cta">When CTA Appears</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Autoplay Audio</Label></div><Switch checked={funnel.audio_note_autoplay} onCheckedChange={(v) => update("audio_note_autoplay", v)} /></div>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Lock Video Until Audio Completes</Label></div><Switch checked={funnel.audio_lock_video} onCheckedChange={(v) => update("audio_lock_video", v)} /></div>
      </div>
    </>
  );

  const renderSpeakerStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Speaker</h2>
      <p className="text-sm text-muted-foreground">Choose how the speaker is shown on your funnel page.</p>
      <div className="space-y-5 mt-4">
        {/* Scope selector — only for multi-step */}
        {isMulti && (
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <Label className="font-semibold">Speaker Mode</Label>
            <div className="flex rounded-xl border border-border overflow-hidden">
              {(["global", "per_step"] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => update("speaker_scope", scope)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    funnel.speaker_scope === scope
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {scope === "global" ? "🌍 One speaker for all steps" : "🎯 Different per step"}
                </button>
              ))}
            </div>
            {funnel.speaker_scope === "per_step" && (
              <p className="text-sm text-muted-foreground">Speaker settings are now managed inside each step. Go to <strong>Build Journey → Edit any step → Speaker</strong> section.</p>
            )}
          </div>
        )}

        {/* Global speaker settings — shown when scope is global (or single mode) */}
        {(funnel.speaker_scope === "global" || !isMulti) && (
          <>
            {/* Mode selector */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              {(["none", "account", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => update("speaker_mode", mode)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                    funnel.speaker_mode === mode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "none" ? "None" : mode === "account" ? "Account" : "Custom"}
                </button>
              ))}
            </div>

            {funnel.speaker_mode === "none" && (
              <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-xl">No speaker info will be shown on the funnel page.</p>
            )}

            {funnel.speaker_mode === "account" && (
              <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden ring-2 ring-primary/20 shrink-0">
                    {userProfile?.avatar_url ? (
                      <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-primary font-heading font-bold text-sm">{userProfile?.full_name?.charAt(0)?.toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">{userProfile?.full_name || "Your Name"}</p>
                    {userProfile?.bio && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{userProfile.bio}</p>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">This is pulled from your account profile. Update it in Profile Settings.</p>
              </div>
            )}

            {funnel.speaker_mode === "custom" && (
              <div className="space-y-4">
                <SpeakerPhotoUpload
                  value={funnel.speaker_photo_url}
                  onChange={(url) => update("speaker_photo_url", url)}
                />
                <div>
                  <Label className="text-sm font-medium">Speaker Name</Label>
                  <Input
                    value={funnel.speaker_name}
                    onChange={(e) => update("speaker_name", e.target.value.slice(0, 60))}
                    placeholder="e.g. Anmol Kapoor"
                    className="mt-1.5 bg-muted border-border"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{funnel.speaker_name.length}/60</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">About Speaker</Label>
                  <Textarea
                    value={funnel.speaker_about}
                    onChange={(e) => update("speaker_about", e.target.value.slice(0, 200))}
                    placeholder="e.g. Network Marketing Leader | Diamond Director at Forever Living"
                    className="mt-1.5 bg-muted border-border"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{funnel.speaker_about.length}/200</p>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden ring-2 ring-primary/20 shrink-0">
                      {funnel.speaker_photo_url ? (
                        <img src={funnel.speaker_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-primary font-heading font-bold text-sm">{funnel.speaker_name?.charAt(0)?.toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm">{funnel.speaker_name || "Speaker Name"}</p>
                      {funnel.speaker_about && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{funnel.speaker_about}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  const renderVideoTopicsStep = () => {
    const topics = funnel.video_topics;
    const updateTopics = (newTopics: string[]) => update("video_topics", newTopics);
    const addTopic = () => { if (topics.length < 10) updateTopics([...topics, ""]); };
    const removeTopic = (i: number) => updateTopics(topics.filter((_: string, idx: number) => idx !== i));
    const updateTopic = (i: number, val: string) => updateTopics(topics.map((t: string, idx: number) => idx === i ? val.slice(0, 100) : t));
    const moveTopic = (from: number, to: number) => {
      if (to < 0 || to >= topics.length) return;
      const arr = [...topics];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      updateTopics(arr);
    };

    return (
      <>
        <h2 className="text-lg font-heading font-semibold">Video Topics</h2>
        <p className="text-sm text-muted-foreground">Add key points covered in your video. These will appear on your funnel page.</p>
        <div className="space-y-5 mt-4">
          {/* Scope selector — only for multi-step */}
          {isMulti && (
            <div className="p-4 bg-muted/50 rounded-xl space-y-3">
              <Label className="font-semibold">Topics Mode</Label>
              <div className="flex rounded-xl border border-border overflow-hidden">
                {(["global", "per_step"] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => update("video_topics_scope", scope)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                      funnel.video_topics_scope === scope
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {scope === "global" ? "🌍 Same for all steps" : "🎯 Different per step"}
                  </button>
                ))}
              </div>
              {funnel.video_topics_scope === "per_step" && (
                <p className="text-sm text-muted-foreground">Video topics are now managed inside each step. Go to <strong>Build Journey → Edit any step → Key Points</strong> section.</p>
              )}
            </div>
          )}

          {/* Global topics — shown when scope is global (or single mode) */}
          {(funnel.video_topics_scope === "global" || !isMulti) && (
            <>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div>
              <Label className="font-semibold">Show Video Topics on funnel page</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Display key points below the video</p>
            </div>
            <Switch checked={funnel.video_topics_enabled} onCheckedChange={(v) => {
              update("video_topics_enabled", v);
              if (v && funnel.video_topics.length === 0) update("video_topics", ["", "", ""]);
            }} />
          </div>

          {!funnel.video_topics_enabled && (
            <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-xl">Video topics section will be hidden on the funnel page.</p>
          )}

          {funnel.video_topics_enabled && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Topics / Key Points</Label>
              <p className="text-xs text-muted-foreground">Add what your prospects will learn from this video.</p>
              <div className="space-y-2">
                {topics.map((topic: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveTopic(idx, idx - 1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ChevronUp size={10} /></button>
                      <button onClick={() => moveTopic(idx, idx + 1)} disabled={idx === topics.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ChevronDown size={10} /></button>
                    </div>
                    <Input
                      value={topic}
                      onChange={(e) => updateTopic(idx, e.target.value)}
                      placeholder="Enter a topic..."
                      className="flex-1 bg-muted border-border"
                      maxLength={100}
                    />
                    {topics.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeTopic(idx)}>
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {topics.length < 10 ? (
                <Button variant="outline" className="w-full" onClick={addTopic}>
                  <Plus size={14} /> Add Topic
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">Maximum 10 topics allowed.</p>
              )}

              {/* Preview */}
              {topics.filter((t: string) => t.trim()).length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                  <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                    <p className="font-heading font-bold text-sm">What you'll learn in this session</p>
                    {topics.filter((t: string) => t.trim()).map((topic: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={11} className="text-emerald-500" />
                        </div>
                        <span className="text-sm">{topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </>
    );
  };

  const renderPrivacyStep = () => (
    <PrivacySettings
      visibility={funnel.visibility}
      accessCode={funnel.access_code_plain}
      requiredFields={funnel.required_fields}
      onVisibilityChange={(v) => update("visibility", v)}
      onAccessCodeChange={(code) => update("access_code_plain", code)}
      onRequiredFieldsChange={(fields) => update("required_fields", fields)}
    />
  );

  const renderWhatsappStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Contact & WhatsApp</h2>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Show Contact Buttons</Label></div><Switch checked={funnel.show_contact_buttons} onCheckedChange={(v) => update("show_contact_buttons", v)} /></div>
        {funnel.show_contact_buttons && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
            <div>
              <Label className="text-xs text-muted-foreground mb-1">WhatsApp Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-muted border border-border rounded-md text-sm text-muted-foreground shrink-0">+91</div>
                <Input placeholder="9876543210" value={funnel.contact_whatsapp?.replace(/^\+91/, "")} onChange={(e) => update("contact_whatsapp", "+91" + e.target.value.replace(/\D/g, ""))} className="bg-muted border-border" />
              </div>
            </div>
            <Input placeholder="Phone Number" value={funnel.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} className="bg-muted border-border" />
            <Input placeholder="Instagram Handle" value={funnel.contact_instagram} onChange={(e) => update("contact_instagram", e.target.value)} className="bg-muted border-border" />
            <div className="flex items-center justify-between"><Label className="text-sm">Show Only After CTA</Label><Switch checked={funnel.show_contact_after_cta} onCheckedChange={(v) => update("show_contact_after_cta", v)} /></div>
          </div>
        )}
        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <div className="flex items-center justify-between"><Label className="font-semibold">WhatsApp Auto-message</Label><Switch checked={funnel.whatsapp_auto_message} onCheckedChange={(v) => update("whatsapp_auto_message", v)} /></div>
          {funnel.whatsapp_auto_message && (
            <Textarea value={funnel.whatsapp_message_template} onChange={(e) => update("whatsapp_message_template", e.target.value)} className="bg-muted border-border" placeholder="Use {name}, {phone}, {funnel_title}" rows={3} />
          )}
        </div>
      </div>
    </>
  );

  const renderPaymentStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Payment (UPI Manual)</h2>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Enable Payment Collection</Label></div><Switch checked={funnel.payment_enabled} onCheckedChange={(v) => update("payment_enabled", v)} /></div>
        {funnel.payment_enabled && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
            <div><Label className="text-sm">UPI ID</Label><Input value={funnel.upi_id} onChange={(e) => update("upi_id", e.target.value)} placeholder="yourname@upi" className="mt-1 bg-muted border-border" /></div>
            <div><Label className="text-sm">QR Code Image URL</Label><Input value={funnel.qr_code_url} onChange={(e) => update("qr_code_url", e.target.value)} placeholder="Paste QR image URL" className="mt-1 bg-muted border-border" /></div>
            <div><Label className="text-sm">Payment Instructions</Label><Textarea value={funnel.payment_instructions} onChange={(e) => update("payment_instructions", e.target.value)} className="mt-1 bg-muted border-border" rows={3} /></div>
          </div>
        )}
      </div>
    </>
  );

  const renderBroadcastStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Live Broadcast</h2>
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl"><div><Label className="font-semibold">Enable Live Broadcast</Label></div><Switch checked={funnel.is_live_broadcast} onCheckedChange={(v) => update("is_live_broadcast", v)} /></div>
        {funnel.is_live_broadcast && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-xl">
            <div><Label className="text-sm">Schedule Date & Time</Label><Input type="datetime-local" value={funnel.broadcast_scheduled_at} onChange={(e) => update("broadcast_scheduled_at", e.target.value)} className="mt-1 bg-muted border-border" /></div>
            <div><Label className="text-sm">Broadcast Password</Label><Input value={funnel.broadcast_password} onChange={(e) => update("broadcast_password", e.target.value)} className="mt-1 bg-muted border-border" /></div>
            <div className="flex items-center justify-between"><Label className="text-sm">Enable Replay</Label><Switch checked={funnel.broadcast_replay_enabled} onCheckedChange={(v) => update("broadcast_replay_enabled", v)} /></div>
          </div>
        )}
      </div>
    </>
  );

  const renderPublishStep = () => (
    <>
      <h2 className="text-lg font-heading font-semibold">Publish</h2>
      <p className="text-sm text-muted-foreground">Review and publish your funnel.</p>
      <div className="space-y-4 mt-4">
        <div className="border border-border rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2"><Check size={16} className={funnel.title ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{funnel.title ? "Title added" : "Add a title"}</span></div>
          {!isMulti && <div className="flex items-center gap-2"><Check size={16} className={selectedVideo ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{selectedVideo ? "Video selected" : "Select a video"}</span></div>}
          {isMulti && <div className="flex items-center gap-2"><Check size={16} className={flowSteps.length > 0 ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{flowSteps.length > 0 ? `${flowSteps.length} journey steps configured` : "Add journey steps"}</span></div>}
          {!isMulti && <div className="flex items-center gap-2"><Check size={16} className={leadForm.capture_enabled ? "text-emerald-500" : "text-muted-foreground"} /><span className="text-sm">{leadForm.capture_enabled ? "Lead capture configured" : "Lead capture disabled"}</span></div>}
        </div>
        {funnel.slug && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <Label className="text-xs text-muted-foreground">Funnel URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm text-primary flex-1 truncate">{window.location.origin}/f/{funnel.slug}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/f/${funnel.slug}`); toast.success("Copied!"); }}>
                <Copy size={14} />
              </Button>
            </div>
          </div>
        )}
        <div className="p-4 bg-muted/50 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-semibold">{funnel.is_published ? "Published" : "Draft"}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {funnel.is_published
                  ? "🟢 Your funnel is live! Anyone with the link can see it."
                  : "🔴 Only you can see this funnel. Toggle to make it public."}
              </p>
            </div>
            <Switch checked={funnel.is_published} onCheckedChange={(v) => update("is_published", v)} />
          </div>
        </div>
      </div>
    </>
  );

  // ── Determine which content to render ──
  const renderWizardContent = () => {
    // Gate: if mode not chosen yet, show mode picker as the FIRST screen
    if (!modeChosen) return renderModePicker();

    if (wizardStep === 0) return renderBasicInfo();

    if (isMulti) {
      if (wizardStep === 1) return renderFlowStepsBuilder();
      return renderCommonStep(2);
    } else {
      if (wizardStep === 1) return renderVideoStep();
      return renderCommonStep(2);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
        {/* Sidebar nav — desktop only */}
        {modeChosen && (
          <div className="hidden lg:flex flex-col gap-1 w-48 shrink-0">
            {visibleSteps.map((s, i) => (
              <button key={i} onClick={() => setWizardStep(i)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  wizardStep === i
                    ? "bg-primary/10 border-l-[3px] border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border-l-[3px] border-transparent"
                }`}
              >
                <s.icon size={15} className={wizardStep === i ? "text-primary" : ""} />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.05em] text-muted-foreground/50">{(s as any).num || i + 1}</p>
                  <p className="text-[13px] font-semibold leading-tight">{s.label}</p>
                </div>
                {i === lastStepIdx && funnel.is_published && <Check size={14} className="ml-auto text-emerald-500" />}
              </button>
            ))}
          </div>
        )}

        {/* Main content + Live Preview */}
        <div className="flex-1 flex gap-6 min-w-0">
          <div className="flex-1 max-w-2xl min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-heading font-bold truncate">{funnel.title || "New Funnel"}</h1>
                {lastSavedAt && <p className="text-xs text-muted-foreground">Auto-saved {lastSavedAt.toLocaleTimeString()}</p>}
              </div>
              {modeChosen && (
                <Button variant="hero" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !funnel.title} className="shrink-0 ml-2">
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              )}
            </div>

            {/* Mobile compact step selector — wrapping grid, no horizontal scroll */}
            {modeChosen && (
              <div className="lg:hidden grid grid-cols-4 sm:grid-cols-5 gap-1.5 pb-3 mb-3">
                {visibleSteps.map((s, i) => (
                  <button key={i} onClick={() => setWizardStep(i)}
                    className={`flex flex-col items-center gap-1 px-1.5 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                      wizardStep === i
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <s.icon size={14} />
                    <span className="truncate w-full text-center leading-tight">{s.label.split(' ').slice(-1)[0]}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {modeChosen && (
              <div className="flex items-center gap-1 mb-4">
                {visibleSteps.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= wizardStep ? "bg-primary" : "bg-muted"}`} />
                ))}
              </div>
            )}

            {/* Content card */}
            <div className="glass-card p-4 sm:p-6 space-y-4">
              {renderWizardContent()}
            </div>

            {/* Navigation — always visible, no horizontal scroll needed */}
            <div className="flex gap-3 mt-4">
              {(modeChosen && wizardStep > 0) && <Button variant="outline" size="sm" onClick={() => setWizardStep(wizardStep - 1)}>Previous</Button>}
              <div className="flex-1" />
              {!modeChosen ? null : wizardStep < lastStepIdx ? (
                <Button variant="default" size="sm" onClick={() => setWizardStep(wizardStep + 1)}>Next</Button>
              ) : (
                <Button variant="hero" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !funnel.title}>
                  {saveMutation.isPending ? "Saving..." : isEdit ? "Update" : "Create Funnel"}
                </Button>
              )}
            </div>
          </div>

          {/* Live Preview — desktop only */}
          {modeChosen && (
            <div className="hidden xl:block w-[300px] shrink-0 sticky top-4 h-[calc(100vh-10rem)]">
              <FunnelLivePreview
                funnel={funnel}
                selectedVideo={selectedVideo}
                flowSteps={flowSteps}
                leadForm={leadForm}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FunnelEditor;
