import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoImg from "@/assets/logo.png";
import {
  normalizeIndianPhone, isValidIndianPhone, isValidEmail,
  cleanText, cleanEmail, phoneInputProps, emailInputProps, nameInputProps,
} from "@/lib/formInputs";

interface PrivateLeadFormProps {
  funnelId: string;
  funnelTitle: string;
  requiredFields: { email: boolean; city: boolean; state: boolean; whatsapp: boolean };
  onSuccess: () => void;
  isDark: boolean;
}

export const PrivateLeadForm = ({
  funnelId,
  funnelTitle,
  requiredFields,
  onSuccess,
  isDark,
}: PrivateLeadFormProps) => {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", city: "", state: "", whatsapp: "",
  });
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);

  const phoneError = form.phone.length > 0 && !isValidIndianPhone(form.phone)
    ? "Enter a valid 10-digit Indian mobile number" : null;
  const emailError = form.email.length > 0 && !isValidEmail(form.email)
    ? "Enter a valid email address" : null;

  const updatePhone = (raw: string) => {
    const v = normalizeIndianPhone(raw);
    setForm((p) => ({ ...p, phone: v, whatsapp: whatsappSameAsPhone ? v : p.whatsapp }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const name = cleanText(form.name);
    if (!name || !form.phone) {
      toast.error("Name and phone are required");
      return;
    }
    if (!isValidIndianPhone(form.phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (form.email && !isValidEmail(form.email)) {
      toast.error("Please enter a valid email");
      return;
    }

    setLoading(true);
    try {
      const finalWhatsapp = whatsappSameAsPhone ? form.phone : form.whatsapp;
      const { error } = await supabase.from("funnel_leads").insert({
        funnel_id: funnelId,
        name,
        phone: form.phone,
        email: form.email ? cleanEmail(form.email) : null,
        city: cleanText(form.city) || null,
        custom_value: JSON.stringify({ state: form.state, whatsapp: finalWhatsapp }),
        device_type: /Mobi/.test(navigator.userAgent) ? "mobile" : "desktop",
        user_agent: navigator.userAgent,
        status: "new",
      });

      if (error) throw error;

      localStorage.setItem(
        `nf_lead_${funnelId}`,
        JSON.stringify({ name, phone: form.phone, submittedAt: Date.now() })
      );

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2500);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  const bg = isDark ? "#09090b" : "#ffffff";
  const cardBg = isDark ? "#141419" : "#f8f9fa";
  const border = isDark ? "#27272a" : "#e5e7eb";
  const text = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#94a3b8" : "#64748b";
  const inputBg = isDark ? "#09090b" : "#f1f5f9";

  // Success state overlay
  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
        <div className="text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-5">
            <Check size={36} className="text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2" style={{ color: text }}>
            Access Confirmed!
          </h2>
          <p className="text-sm mb-1" style={{ color: textMuted }}>
            Welcome to the program, {form.name.split(" ")[0]}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Sparkles size={14} className="text-primary animate-pulse" />
            <p className="text-xs font-medium" style={{ color: textMuted }}>
              Unlocking your content…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: bg }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src={logoImg} alt="Smart Income Program" className="h-6 w-6" />
          <span className="font-heading font-bold text-[14px]" style={{ color: text }}>Smart Income</span>
          <span className="font-heading font-extrabold text-primary text-[14px]" style={{ fontStyle: "italic", transform: "skewX(-4deg)", display: "inline-block", marginLeft: "-3px" }}>Flow</span>
        </div>

        <div className="rounded-2xl p-6" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className="text-center mb-5">
            <h3 className="text-lg font-heading font-bold mb-1" style={{ color: text }}>{funnelTitle}</h3>
            <p className="text-sm" style={{ color: textMuted }}>Enter your details to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs font-medium" style={{ color: textMuted }}>Full Name *</Label>
              <Input
                {...nameInputProps}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onBlur={() => setForm((p) => ({ ...p, name: cleanText(p.name) }))}
                placeholder="Your full name"
                required
                className="mt-1 h-11"
                style={{ background: inputBg, borderColor: border, color: text }}
              />
            </div>

            <div>
              <Label className="text-xs font-medium" style={{ color: textMuted }}>Phone Number *</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex items-center px-3 rounded-md text-sm shrink-0 h-11" style={{ background: inputBg, border: `1px solid ${border}`, color: textMuted }}>+91</div>
                <Input
                  {...phoneInputProps}
                  value={form.phone}
                  onChange={(e) => updatePhone(e.target.value)}
                  placeholder="9876543210"
                  required
                  aria-invalid={!!phoneError}
                  className="h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
              {phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
            </div>

            {requiredFields.email && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>Email Address</Label>
                <Input
                  {...emailInputProps}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.replace(/\s/g, "") })}
                  onBlur={() => setForm((p) => ({ ...p, email: cleanEmail(p.email) }))}
                  placeholder="your@email.com"
                  aria-invalid={!!emailError}
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
                {emailError && <p className="text-xs text-red-400 mt-1">{emailError}</p>}
              </div>
            )}

            {requiredFields.city && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>City</Label>
                <Input
                  autoCapitalize="words"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  onBlur={() => setForm((p) => ({ ...p, city: cleanText(p.city) }))}
                  placeholder="Your city"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            )}

            {requiredFields.state && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>State</Label>
                <Input
                  autoCapitalize="words"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  onBlur={() => setForm((p) => ({ ...p, state: cleanText(p.state) }))}
                  placeholder="Your state"
                  className="mt-1 h-11"
                  style={{ background: inputBg, borderColor: border, color: text }}
                />
              </div>
            )}

            {requiredFields.whatsapp && (
              <div>
                <Label className="text-xs font-medium" style={{ color: textMuted }}>WhatsApp Number</Label>
                <label className="flex items-center gap-2 text-xs mt-1 mb-1.5 cursor-pointer select-none" style={{ color: textMuted }}>
                  <input
                    type="checkbox"
                    checked={whatsappSameAsPhone}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setWhatsappSameAsPhone(checked);
                      if (checked) setForm((p) => ({ ...p, whatsapp: p.phone }));
                    }}
                    className="accent-primary"
                  />
                  Same as phone number
                </label>
                {!whatsappSameAsPhone && (
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 rounded-md text-sm shrink-0 h-11" style={{ background: inputBg, border: `1px solid ${border}`, color: textMuted }}>+91</div>
                    <Input
                      {...phoneInputProps}
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: normalizeIndianPhone(e.target.value) })}
                      placeholder="WhatsApp number"
                      className="h-11"
                      style={{ background: inputBg, borderColor: border, color: text }}
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl mt-2"
              disabled={loading}
            >
              {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Unlocking access...</> : "Continue to Program →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
