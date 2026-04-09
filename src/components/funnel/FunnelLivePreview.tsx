import { Play, Lock, Users, MessageCircle, Phone as PhoneIcon, Eye, Layers } from "lucide-react";
import logoImg from "@/assets/logo.png";

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
  flowSteps: { title: string; step_type: string; step_order: number }[];
  leadForm: {
    capture_enabled: boolean;
    show_name: boolean;
    show_phone: boolean;
    show_email: boolean;
    show_city: boolean;
    show_custom: boolean;
    custom_field_label: string;
  };
}

export const FunnelLivePreview = ({ funnel, selectedVideo, flowSteps, leadForm }: FunnelLivePreviewProps) => {
  const isMulti = funnel.funnel_mode === "multi";
  const isPrivate = funnel.visibility === "private";

  return (
    <div className="w-full h-full overflow-y-auto rounded-xl border border-border bg-[#09090b] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <Eye size={11} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live Preview</span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Logo */}
        <div className="flex items-center gap-1.5 justify-center">
          <img src={logoImg} alt="" className="h-4 w-4" />
          <span className="font-heading font-bold text-[11px]">Smart Income</span>
          <span className="font-heading font-extrabold text-primary text-[11px]" style={{ fontStyle: "italic" }}>Flow</span>
        </div>

        {/* Title */}
        <h2 className="font-heading font-extrabold text-center text-sm leading-tight">
          {funnel.title || "Your Funnel Title"}
        </h2>
        {funnel.description && (
          <p className="text-[10px] text-white/60 text-center">{funnel.description}</p>
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
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px]"
                style={{
                  background: idx === 0 ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                  border: idx === 0 ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {idx === 0 ? (
                  <Play size={10} className="text-green-400 shrink-0" />
                ) : (
                  <Lock size={10} className="text-white/30 shrink-0" />
                )}
                <span className={idx === 0 ? "text-white font-medium" : "text-white/40"}>
                  {step.title || `Step ${idx + 1}`}
                </span>
              </div>
            ))}
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
