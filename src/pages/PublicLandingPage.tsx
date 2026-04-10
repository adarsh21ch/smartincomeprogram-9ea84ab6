import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/landing/Logo";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Check, Lock, ChevronRight, ChevronDown, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { TestimonialsViewer } from "@/components/funnel/TestimonialsViewer";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli and Daman & Diu","Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry"
];

const PublicLandingPage = () => {
  const { slug } = useParams();
  const [page, setPage] = useState<any>(null);
  const [video, setVideo] = useState<any>(null);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [showUnmuteHint, setShowUnmuteHint] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-hide unmute hint after 5 seconds
  useEffect(() => {
    if (submitted && showUnmuteHint) {
      const t = setTimeout(() => setShowUnmuteHint(false), 5000);
      return () => clearTimeout(t);
    }
  }, [submitted, showUnmuteHint]);

  // Autoplay fallback
  useEffect(() => {
    if (submitted && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [submitted]);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .single();
      if (data) {
        setPage(data);
        const saved = localStorage.getItem(`nf_registered_${data.id}`);
        if (saved) setSubmitted(true);
        if (data.post_submit_video_asset_id) {
          const { data: v } = await supabase
            .from("video_assets")
            .select("id,title,public_url,thumbnail_url")
            .eq("id", data.post_submit_video_asset_id)
            .single();
          if (v) setVideo(v);
        }
        supabase.rpc("increment_landing_page_views", { _landing_page_id: data.id });
        // Fetch testimonials if enabled
        if (data.testimonials_enabled) {
          const { data: tData } = await supabase
            .from("landing_page_testimonials")
            .select("*")
            .eq("landing_page_id", data.id)
            .eq("is_active", true)
            .order("display_order", { ascending: true });
          setTestimonials(tData || []);
        }
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page || submitting) return;
    if (honeypot) { setSubmitted(true); return; }

    setSubmitting(true);
    try {
      const payload: any = {
        landing_page_id: page.id,
        honeypot: "",
        ...formData,
        user_agent: navigator.userAgent,
      };

      const { data, error } = await supabase.functions.invoke("submit-landing-page-registration", {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      localStorage.setItem(`nf_registered_${page.id}`, JSON.stringify({
        name: formData.name, email: formData.email, submittedAt: Date.now(),
      }));

      // Show toast and immediately reveal post-submit content
      toast.success("🎉 You're registered! Check your email for confirmation.", {
        duration: 5000,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground">This landing page doesn't exist or isn't published.</p>
        </div>
      </div>
    );
  }

  const sections = (page.sections as any[]) || [];
  const themeColor = page.theme_color || "#E8B830";
  const displayPos = page.testimonials_display_position || "post_registration";
  const showTestimonialsOnRegistration = page.testimonials_enabled && testimonials.length > 0 && (displayPos === "registration" || displayPos === "both");
  const showTestimonialsPostRegistration = page.testimonials_enabled && testimonials.length > 0 && (displayPos === "post_registration" || displayPos === "both");

  const formFields = [
    { key: "name", label: "Full Name", enabled: page.field_name_enabled, required: page.field_name_required },
    { key: "phone", label: "Phone Number", enabled: page.field_phone_enabled, required: page.field_phone_required, prefix: "+91" },
    { key: "email", label: "Email Address", enabled: page.field_email_enabled, required: page.field_email_required, type: "email" },
    { key: "age", label: "Age", enabled: page.field_age_enabled, required: page.field_age_required },
    { key: "city", label: "City", enabled: page.field_city_enabled, required: page.field_city_required },
    { key: "state", label: "State", enabled: page.field_state_enabled, required: page.field_state_required, fieldType: "state_dropdown" },
    { key: "occupation", label: "Occupation", enabled: page.field_occupation_enabled, required: page.field_occupation_required },
    ...(page.field_custom_1_enabled ? [{ key: "custom_1_value", label: page.field_custom_1_label || "Custom 1", enabled: true, required: page.field_custom_1_required }] : []),
    ...(page.field_custom_2_enabled ? [{ key: "custom_2_value", label: page.field_custom_2_label || "Custom 2", enabled: true, required: page.field_custom_2_required }] : []),
  ].filter((f) => f.enabled);

  const renderSection = (section: any, i: number) => {
    switch (section.type) {
      case "hero":
        return (
          <div key={i} className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">{section.headline}</h1>
            {section.subheadline && <p className="text-lg text-muted-foreground">{section.subheadline}</p>}
            {section.image_url && <img src={section.image_url} alt="" className="rounded-xl w-full object-contain" />}
            {section.cta_text && <p className="text-primary font-semibold text-lg">{section.cta_text}</p>}
          </div>
        );
      case "text":
        return (
          <div key={i} className={`space-y-2 ${section.alignment === "center" ? "text-center" : ""}`}>
            {section.heading && <h2 className="text-2xl font-bold">{section.heading}</h2>}
            {section.body && <p className="text-muted-foreground whitespace-pre-line">{section.body}</p>}
          </div>
        );
      case "features":
        return (
          <div key={i} className="space-y-4">
            {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
            <div className={section.layout === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
              {(section.items || []).map((item: any, j: number) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="text-lg">{item.emoji}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case "testimonials":
        return (
          <div key={i} className="space-y-4">
            {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
            <div className="grid gap-4 md:grid-cols-2">
              {(section.items || []).map((item: any, j: number) => (
                <Card key={j} className="p-4">
                  <p className="italic text-muted-foreground mb-3">"{item.quote}"</p>
                  <div className="font-semibold">{item.name}</div>
                  {item.role && <div className="text-xs text-muted-foreground">{item.role}</div>}
                </Card>
              ))}
            </div>
          </div>
        );
      case "faq":
        return (
          <div key={i} className="space-y-4">
            {section.title && <h2 className="text-2xl font-bold">{section.title}</h2>}
            <Accordion type="single" collapsible className="w-full">
              {(section.items || []).map((item: any, j: number) => (
                <AccordionItem key={j} value={`faq-${i}-${j}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );
      case "speaker":
        return (
          <Card key={i} className="p-6 flex flex-col sm:flex-row gap-4 items-center">
            {section.photo_url && (
              <img src={section.photo_url} alt={section.name} className="w-24 h-24 rounded-full object-cover" />
            )}
            <div>
              <h3 className="text-xl font-bold">{section.name}</h3>
              {section.title && <p className="text-sm text-muted-foreground">{section.title}</p>}
              {section.bio && <p className="mt-2 text-sm">{section.bio}</p>}
            </div>
          </Card>
        );
      case "image":
        return (
          <div key={i} className={section.size === "full" ? "" : "max-w-lg mx-auto"}>
            {section.url && <img src={section.url} alt={section.caption || ""} className="rounded-xl w-full" />}
            {section.caption && <p className="text-xs text-muted-foreground text-center mt-2">{section.caption}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sip-landing min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-center px-4 py-3" style={{ borderBottom: '1px solid rgba(197,147,14,0.15)' }}>
        <Logo size="sm" />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-6 lg:px-8 py-6 md:py-8 max-w-7xl mx-auto w-full">
        {/* Preload video in background while user fills form */}
        {video?.public_url && !submitted && (
          <video src={video.public_url} preload="auto" muted className="hidden" aria-hidden="true" />
        )}

        {submitted ? (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
            {video?.public_url ? (
              <>
                {page.post_submit_video_title && (
                  <div className="text-center space-y-2">
                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#F5F0E8' }}>{page.post_submit_video_title}</h2>
                    {page.post_submit_video_description && (
                      <p className="text-sm md:text-base" style={{ color: '#888' }}>{page.post_submit_video_description}</p>
                    )}
                  </div>
                )}
                <div className="relative rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    src={video.public_url}
                    poster={video.thumbnail_url || undefined}
                    autoPlay
                    muted
                    playsInline
                    controls
                    className="w-full aspect-video bg-black rounded-xl"
                  />
                  {showUnmuteHint && (
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.muted = false;
                        }
                        setShowUnmuteHint(false);
                      }}
                      className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm animate-in fade-in"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      <VolumeX size={14} /> Tap to unmute
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="sip-card p-8 md:p-12 text-center space-y-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(197,147,14,0.15)' }}>
                  <Check style={{ color: '#E8B830' }} size={32} />
                </div>
                <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#F5F0E8' }}>You're Registered!</h2>
                <p className="text-sm md:text-base" style={{ color: '#888' }}>Thank you for registering. We'll see you at the session!</p>
              </div>
            )}
            {/* Testimonials after registration */}
            {showTestimonialsPostRegistration && (
              <div className="mt-8">
                <TestimonialsViewer
                  testimonials={testimonials}
                  sectionTitle={page.testimonials_section_title || "What our members say"}
                />
              </div>
            )}
            {page.linked_funnel_id && (
              <button
                className="w-full px-6 py-3.5 rounded-lg text-base font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #E8B830, #C99A18)', color: '#000' }}
                onClick={() => window.location.href = `/f/${page.linked_funnel_id}`}
              >
                Continue to full session journey <ChevronRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── MOBILE LAYOUT (< lg) ── */}
            <div className="lg:hidden space-y-6">
              {/* Sections (hero, features etc.) */}
              <div className="space-y-6">
                {sections.map(renderSection)}
                {sections.length === 0 && (
                  <div className="space-y-3">
                    <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#F5F0E8' }}>{page.title}</h1>
                    {page.description && <p className="text-base" style={{ color: '#888' }}>{page.description}</p>}
                  </div>
                )}
              </div>

              {/* Speaker */}
              {(page.speaker_name || page.speaker_photo_url) && (
                <div className="sip-card p-4 flex flex-col sm:flex-row gap-3 items-center">
                  {page.speaker_photo_url && (
                    <img src={page.speaker_photo_url} alt={page.speaker_name} className="w-20 h-20 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(197,147,14,0.3)' }} />
                  )}
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-bold" style={{ color: '#F5F0E8' }}>{page.speaker_name}</h3>
                    {page.speaker_role && <p className="text-xs" style={{ color: '#888' }}>{page.speaker_role}</p>}
                    {page.speaker_bio && <p className="mt-1 text-xs leading-relaxed" style={{ color: '#aaa' }}>{page.speaker_bio}</p>}
                  </div>
                </div>
              )}

              {/* Testimonials BEFORE registration form on mobile */}
              {showTestimonialsOnRegistration && (
                <div>
                  <TestimonialsViewer
                    testimonials={testimonials}
                    sectionTitle={page.testimonials_section_title || "What our members say"}
                  />
                </div>
              )}

              {/* Register Now scroll button */}
              <button
                type="button"
                onClick={() => {
                  document.getElementById('mobile-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="w-full px-6 py-3 rounded-lg text-base font-semibold flex items-center justify-center gap-2 sticky top-2 z-30"
                style={{ background: 'linear-gradient(135deg, #E8B830, #C99A18)', color: '#000', boxShadow: '0 4px 20px rgba(232,184,48,0.3)' }}
              >
                Register Now <ChevronDown size={18} />
              </button>

              {/* Registration form */}
              <div id="mobile-register-form" className="sip-card p-5 space-y-4 scroll-mt-4">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: '#F5F0E8' }}>{page.form_title}</h3>
                  <p className="text-sm" style={{ color: '#E8B830' }}>{page.form_subtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    className="absolute opacity-0 h-0 w-0 pointer-events-none"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  {formFields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-sm" style={{ color: '#F5F0E8' }}>{f.label} {f.required && <span style={{ color: '#E8B830' }}>*</span>}</Label>
                      {(f as any).fieldType === "state_dropdown" ? (
                        <Select
                          value={formData[f.key] || "__none__"}
                          onValueChange={(val) => setFormData((prev) => ({ ...prev, [f.key]: val === "__none__" ? "" : val }))}
                        >
                          <SelectTrigger className="bg-[#181818] border-[rgba(197,147,14,0.2)] text-white h-10">
                            <SelectValue placeholder="Select State" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" disabled>Select State</SelectItem>
                            {INDIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={(f as any).type || "text"}
                          placeholder={(f as any).prefix ? `${(f as any).prefix} ` : ""}
                          value={formData[f.key] || ""}
                          onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          required={f.required}
                          className="bg-[#181818] border-[rgba(197,147,14,0.2)] text-white placeholder:text-[#555] h-10"
                        />
                      )}
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-3 rounded-lg text-base font-semibold transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #E8B830, #C99A18)', color: '#000' }}
                  >
                    {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    {page.form_button_text} →
                  </button>
                </form>

                <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: '#888' }}>
                  <Lock size={12} /> Your information is safe with us
                </p>
              </div>
            </div>

            {/* ── DESKTOP LAYOUT (lg+) ── */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-8 items-start">
              <div className="lg:col-span-3 space-y-8">
                {sections.map(renderSection)}
                {sections.length === 0 && (
                  <div className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#F5F0E8' }}>{page.title}</h1>
                    {page.description && <p className="text-lg" style={{ color: '#888' }}>{page.description}</p>}
                  </div>
                )}

                {/* Speaker */}
                {(page.speaker_name || page.speaker_photo_url) && (
                  <div className="sip-card p-6 flex gap-5 items-start">
                    {page.speaker_photo_url && (
                      <img src={page.speaker_photo_url} alt={page.speaker_name} className="w-20 h-20 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(197,147,14,0.3)' }} />
                    )}
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold" style={{ color: '#F5F0E8' }}>{page.speaker_name}</h3>
                      {page.speaker_role && <p className="text-xs font-medium mt-0.5" style={{ color: '#888' }}>{page.speaker_role}</p>}
                      {page.speaker_bio && <p className="mt-2 text-sm leading-relaxed" style={{ color: '#aaa' }}>{page.speaker_bio}</p>}
                    </div>
                  </div>
                )}

                {/* Testimonials — shown on left before form */}
                {showTestimonialsOnRegistration && (
                  <TestimonialsViewer
                    testimonials={testimonials}
                    sectionTitle={page.testimonials_section_title || "What our members say"}
                  />
                )}
              </div>

              <div className="lg:col-span-2 lg:sticky lg:top-8">
                <div className="sip-card p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: '#F5F0E8' }}>{page.form_title}</h3>
                    <p className="text-sm" style={{ color: '#E8B830' }}>{page.form_subtitle}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                      type="text"
                      name="website"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      className="absolute opacity-0 h-0 w-0 pointer-events-none"
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    {formFields.map((f) => (
                      <div key={f.key} className="space-y-1.5">
                        <Label style={{ color: '#F5F0E8' }}>{f.label} {f.required && <span style={{ color: '#E8B830' }}>*</span>}</Label>
                        {(f as any).fieldType === "state_dropdown" ? (
                          <Select
                            value={formData[f.key] || "__none__"}
                            onValueChange={(val) => setFormData((prev) => ({ ...prev, [f.key]: val === "__none__" ? "" : val }))}
                          >
                            <SelectTrigger className="bg-[#181818] border-[rgba(197,147,14,0.2)] text-white">
                              <SelectValue placeholder="Select State" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__" disabled>Select State</SelectItem>
                              {INDIAN_STATES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={(f as any).type || "text"}
                            placeholder={(f as any).prefix ? `${(f as any).prefix} ` : ""}
                            value={formData[f.key] || ""}
                            onChange={(e) => setFormData((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            required={f.required}
                            className="bg-[#181818] border-[rgba(197,147,14,0.2)] text-white placeholder:text-[#555]"
                          />
                        )}
                      </div>
                    ))}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-8 py-3.5 rounded-lg text-base font-semibold transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #E8B830, #C99A18)', color: '#000' }}
                    >
                      {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                      {page.form_button_text} →
                    </button>
                  </form>

                  <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: '#888' }}>
                    <Lock size={12} /> Your information is safe with us
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-4 text-xs" style={{ color: '#555', borderTop: '1px solid rgba(197,147,14,0.15)' }}>
        © Smart Income Program · Powered by Smart Income
      </footer>
    </div>
  );
};

export default PublicLandingPage;
