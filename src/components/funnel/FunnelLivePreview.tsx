import { Play, Lock, MessageCircle, Phone as PhoneIcon, Eye, Layers } from "lucide-react";

interface PreviewStep {
  title: string;
  step_type: string;
  step_order: number;
  time_delay_enabled?: boolean;
  time_delay_minutes?: number;
  timer_cta_enabled?: boolean;
  timer_cta_text?: string;
  timer_cta_style?: string;
}

interface FunnelLivePreviewProps {
  funnel: {
    title: string;
    description: string;
    funnel_mode: "single" | "multi";
    visibility: string;
    cta_enabled: boolean;
    cta_text: string;
    show_contact_buttons: boolean;
    contact_whatsapp: string;
    contact_phone: string;
    payment_enabled: boolean;
    required_fields: { email: boolean; city: boolean; state: boolean; whatsapp: boolean };
  };
  selectedVideo: { title: string; url: string | null } | null;
  flowSteps: PreviewStep[];
  leadForm: {
    capture_enabled: boolean;
    show_name: boolean;
    show_phone: boolean;
    show_email: boolean;
    show_city: boolean;
    show_custom: boolean;
    custom_field_label: string;
  };
  previewStepIndex?: number | null;
}

const getTimerPreviewButtonStyle = (style?: string) => {
  if (style === "white") {
    return {
      background: "hsl(0 0% 100%)",
      color: "hsl(222 47% 11%)",
      border: "none",
    };
  }

  if (style === "outline") {
    return {
      background: "transparent",
      color: "hsl(0 0% 100%)",
      border: "1px solid hsl(0 0% 100% / 0.35)",
    };
  }

  return {
    background: "hsl(44 77% 47%)",
    color: "hsl(222 47% 11%)",
    border: "none",
  };
};

export const FunnelLivePreview = ({ funnel, selectedVideo, flowSteps, leadForm, previewStepIndex = null }: FunnelLivePreviewProps) => {
  const isMulti = funnel.funnel_mode === "multi";
  const isPrivate = funnel.visibility === "private";
  const selectedPreviewStep = typeof previewStepIndex === "number"
    ? flowSteps[previewStepIndex]
    : flowSteps.find((step, idx) => idx > 0 && step.time_delay_enabled && (step.time_delay_minutes || 0) > 0);
  const timerPreviewStep = selectedPreviewStep && selectedPreviewStep.time_delay_enabled && (selectedPreviewStep.time_delay_minutes || 0) > 0
    ? selectedPreviewStep
    : null;
  const timerPreviewTotalSeconds = timerPreviewStep
    ? Math.max(59, (timerPreviewStep.time_delay_minutes || 30) * 60 - 1)
    : 0;
  const timerPreviewParts = timerPreviewStep
    ? [
        ...(timerPreviewTotalSeconds >= 3600
          ? [{ label: "hr", value: Math.floor(timerPreviewTotalSeconds / 3600) }]
          : []),
        { label: "min", value: Math.floor((timerPreviewTotalSeconds % 3600) / 60) },
        { label: "sec", value: timerPreviewTotalSeconds % 60 },
      ]
    : [];

  return (
    <div className="w-full h-full overflow-y-auto rounded-xl border border-border bg-card text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Eye size={12} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live Preview</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">This is what your prospects see</p>
      </div>

      <div className="p-3 space-y-3">
        {/* Title */}
        <h2 className="font-heading font-extrabold text-center text-sm leading-tight text-foreground">
          {funnel.title || "Your Funnel Title"}
        </h2>
        {funnel.description && (
          <p className="text-[10px] text-muted-foreground text-center">{funnel.description}</p>
        )}

        {/* Private badge */}
        {isPrivate && (
          <div className="flex items-center justify-center gap-1 text-[10px] text-amber-400">
            <Lock size={10} /> Private · Access Code Required
          </div>
        )}

        {/* Video placeholder */}
        {!isMulti && (
          <div className="aspect-video bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
            {selectedVideo?.url ? (
              <video src={selectedVideo.url} className="w-full h-full object-contain rounded-lg" />
            ) : (
              <div className="text-center">
                <Play size={24} className="text-white/30 mx-auto mb-1" />
                <p className="text-[9px] text-white/30">
                  {selectedVideo ? selectedVideo.title : "No video selected"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Multi-step journey preview */}
        {isMulti && flowSteps.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Layers size={11} className="text-primary" />
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Journey</span>
            </div>
            {flowSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 px-2.5 py-2 rounded-lg text-[11px]"
                style={{
                  background: timerPreviewStep?.step_order === step.step_order
                    ? "rgba(232,184,48,0.1)"
                    : idx === 0
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(255,255,255,0.04)",
                  border: timerPreviewStep?.step_order === step.step_order
                    ? "1px solid rgba(232,184,48,0.28)"
                    : idx === 0
                    ? "1px solid rgba(34,197,94,0.25)"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {idx === 0 ? (
                  <Play size={10} className="text-gold shrink-0" />
                ) : (
                  <Lock size={10} className="text-white/30 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span className={idx === 0 ? "text-white font-medium" : "text-white/40"}>
                    {step.title || `Step ${idx + 1}`}
                  </span>

                  {(step.time_delay_enabled || step.timer_cta_enabled) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {step.time_delay_enabled && (step.time_delay_minutes || 0) > 0 && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
                          ⏱ {step.time_delay_minutes} min wait
                        </span>
                      )}
                      {step.timer_cta_enabled && step.timer_cta_text && (
                        <span className="rounded-full border border-[rgba(232,184,48,0.2)] bg-[rgba(232,184,48,0.08)] px-1.5 py-0.5 text-[9px] font-semibold text-[hsl(44_77%_60%)]">
                          CTA during wait
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {timerPreviewStep && (
          <div className="rounded-lg p-3 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Wait Screen Preview</p>
                <p className="text-[10px] text-white/40 mt-1">
                  Viewers see this before {timerPreviewStep.title || `Step ${(timerPreviewStep.step_order || 0) + 1}`} unlocks.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[rgba(232,184,48,0.25)] bg-[rgba(232,184,48,0.1)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[hsl(44_77%_60%)]">
                {timerPreviewStep.time_delay_minutes || 30} min
              </span>
            </div>

            <div
              className="relative overflow-hidden rounded-xl border border-white/10 min-h-[190px]"
              style={{ background: "radial-gradient(circle at top, hsl(44 77% 47% / 0.18), transparent 58%), rgba(255,255,255,0.04)" }}
            >
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }} />

              <div className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-3 py-5 text-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(232,184,48,0.12)", border: "1px solid rgba(232,184,48,0.3)" }}>
                  <Lock size={16} style={{ color: "hsl(44 77% 60%)" }} />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Upcoming</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {timerPreviewStep.title || `Step ${(timerPreviewStep.step_order || 0) + 1}`}
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  {timerPreviewParts.map((part, idx) => (
                    <div key={`${part.label}-${idx}`} className="flex items-start gap-2">
                      <div className="text-center">
                        <div className="min-w-[52px] rounded-lg px-2.5 py-2" style={{ background: "rgba(232,184,48,0.12)", border: "1px solid rgba(232,184,48,0.22)" }}>
                          <span className="text-xl font-extrabold tabular-nums" style={{ color: "hsl(44 77% 60%)" }}>
                            {part.value.toString().padStart(2, "0")}
                          </span>
                        </div>
                        <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.14em] text-white/35">
                          {part.label}
                        </span>
                      </div>
                      {idx < timerPreviewParts.length - 1 && (
                        <span className="pt-2 text-lg font-bold text-white/35">:</span>
                      )}
                    </div>
                  ))}
                </div>

                {timerPreviewStep.timer_cta_enabled ? (
                  <div
                    className="w-full max-w-[210px] rounded-lg px-3 py-2.5 text-[11px] font-bold"
                    style={getTimerPreviewButtonStyle(timerPreviewStep.timer_cta_style)}
                  >
                    {timerPreviewStep.timer_cta_text?.trim() || "Contact your mentor on WhatsApp →"}
                  </div>
                ) : (
                  <p className="text-[10px] text-white/40">Timer CTA is disabled for this step.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lead form preview */}
        {!isPrivate && leadForm.capture_enabled && (
          <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Lead Form</p>
            {leadForm.show_name && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">Full Name</div>}
            {leadForm.show_phone && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">Phone Number</div>}
            {leadForm.show_email && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">Email Address</div>}
            {leadForm.show_city && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">City</div>}
            {leadForm.show_custom && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">{leadForm.custom_field_label || "Custom Field"}</div>}
          </div>
        )}

        {/* Private lead form preview */}
        {isPrivate && (
          <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Viewer Registration</p>
            <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">Full Name</div>
            <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">Phone Number</div>
            {funnel.required_fields.email && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">Email Address</div>}
            {funnel.required_fields.city && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">City</div>}
            {funnel.required_fields.state && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">State</div>}
            {funnel.required_fields.whatsapp && <div className="h-7 rounded bg-white/5 border border-white/10 px-2 flex items-center text-[10px] text-white/30">WhatsApp Number</div>}
          </div>
        )}

        {/* CTA */}
        {funnel.cta_enabled && !isMulti && (
          <div className="w-full py-2.5 rounded-lg bg-primary text-center text-[11px] font-bold text-primary-foreground">
            {funnel.cta_text || "Get Started"} →
          </div>
        )}

        {/* Contact buttons */}
        {funnel.show_contact_buttons && (funnel.contact_whatsapp || funnel.contact_phone) && (
          <div className="flex gap-2">
            {funnel.contact_whatsapp && (
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold" style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.2)" }}>
                <MessageCircle size={11} /> WhatsApp
              </div>
            )}
            {funnel.contact_phone && (
              <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
                <PhoneIcon size={11} /> Call
              </div>
            )}
          </div>
        )}

        {/* Payment indicator */}
        {funnel.payment_enabled && (
          <div className="text-center py-2 rounded-lg text-[10px] text-amber-400" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
            💳 Payment gate enabled
          </div>
        )}
      </div>
    </div>
  );
};
