import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, GripVertical, Star, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { TestimonialPhotoUpload } from "@/components/funnel/TestimonialPhotoUpload";
import { TestimonialVideoUpload } from "@/components/funnel/TestimonialVideoUpload";

interface TestimonialsBuilderStepProps {
  landingPageId: string | undefined;
  userId: string;
  testimonialsEnabled: boolean;
  testimonialsSectionTitle: string;
  testimonialsDisplayPosition: string;
  onToggleEnabled: (v: boolean) => void;
  onTitleChange: (v: string) => void;
  onDisplayPositionChange: (v: string) => void;
}

// Debounced input
const DebouncedInput = memo(({ value: externalValue, onSave, placeholder, className, autoFocus }: {
  value: string; onSave: (val: string) => void; placeholder?: string; className?: string; autoFocus?: boolean;
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => { setLocalValue(externalValue); }, [externalValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSaveRef.current(val), 600);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return <Input placeholder={placeholder} value={localValue} onChange={handleChange} className={className} autoFocus={autoFocus} />;
});
DebouncedInput.displayName = "DebouncedInput";

const DebouncedTextarea = memo(({ value: externalValue, onSave, placeholder, className, maxLength, rows }: {
  value: string; onSave: (val: string) => void; placeholder?: string; className?: string; maxLength?: number; rows?: number;
}) => {
  const [localValue, setLocalValue] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => { setLocalValue(externalValue); }, [externalValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSaveRef.current(val), 600);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div>
      <Textarea placeholder={placeholder} value={localValue} maxLength={maxLength} onChange={handleChange} rows={rows} className={className} />
      {maxLength && (
        <p className="text-[10px] text-muted-foreground text-right mt-1">{localValue.length}/{maxLength}</p>
      )}
    </div>
  );
});
DebouncedTextarea.displayName = "DebouncedTextarea";

const getTestimonialType = (textEnabled: boolean, videoEnabled: boolean): string => {
  if (textEnabled && videoEnabled) return "both";
  if (videoEnabled) return "video";
  return "text";
};

export const TestimonialsBuilderStep = ({
  landingPageId, userId, testimonialsEnabled, testimonialsSectionTitle, testimonialsDisplayPosition, onToggleEnabled, onTitleChange, onDisplayPositionChange,
}: TestimonialsBuilderStepProps) => {
  const queryClient = useQueryClient();
  const MAX_PER_PAGE = 4;

  const { data: platformSettings = [] } = useQuery({
    queryKey: ["platform-settings-testimonials"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings").select("key,value")
        .in("key", ["testimonial_max_video_seconds", "testimonial_video_feature_enabled"]);
      return data || [];
    },
    staleTime: 60000,
  });

  const getSetting = (key: string, fallback: string) =>
    platformSettings.find((s) => s.key === key)?.value || fallback;

  const maxVideoSeconds = parseInt(getSetting("testimonial_max_video_seconds", "90"), 10);

  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ["landing-page-testimonials", landingPageId],
    queryFn: async () => {
      if (!landingPageId) return [];
      const { data } = await supabase
        .from("landing_page_testimonials").select("*")
        .eq("landing_page_id", landingPageId)
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: !!landingPageId,
    staleTime: 10000,
  });

  const totalCount = testimonials.length;
  const limitReached = totalCount >= MAX_PER_PAGE;

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!landingPageId) throw new Error("Please save the landing page first.");
      const { error } = await supabase.from("landing_page_testimonials").insert({
        landing_page_id: landingPageId,
        owner_id: userId,
        type: "video",
        student_name: "",
        display_order: totalCount,
        placement: "registration",
        rating: 5,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-testimonials", landingPageId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = useCallback(async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("landing_page_testimonials").update(updates as any).eq("id", id);
    if (error) toast.error(error.message);
  }, []);

  const updateAndRefresh = useCallback(async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("landing_page_testimonials").update(updates as any).eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["landing-page-testimonials", landingPageId] });
  }, [landingPageId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_page_testimonials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-page-testimonials", landingPageId] });
      toast.success("Testimonial deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDelete = useCallback((id: string) => {
    if (confirm("Delete this testimonial?")) deleteMutation.mutate(id);
  }, [deleteMutation]);

  if (!landingPageId) {
    return (
      <>
        <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
          <Star size={18} className="text-primary" /> Testimonials
        </h2>
        <p className="text-sm text-muted-foreground">Save the landing page first to add testimonials.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
        <Star size={18} className="text-primary" /> Testimonials
      </h2>
      <p className="text-sm text-muted-foreground">Add testimonials with text, video, or both to show social proof.</p>

      <div className="space-y-4 mt-4">
        <div className="p-4 bg-muted/50 rounded-xl flex items-center justify-between">
          <div>
            <Label className="font-semibold">Enable Testimonials Section</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Show testimonials on landing & post-registration pages</p>
          </div>
          <Switch checked={testimonialsEnabled} onCheckedChange={onToggleEnabled} />
        </div>

        <div className={!testimonialsEnabled ? "opacity-50 pointer-events-none" : ""}>
          <div className="p-4 bg-muted/50 rounded-xl space-y-2">
            <Label>Section Title</Label>
            <Input
              value={testimonialsSectionTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="What our members say"
              className="bg-muted border-border"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Each testimonial can be placed on the Registration Page (before the form) or After Registration (on the thank you / post-signup page). Set the placement inside each individual testimonial below.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Star size={14} className="text-primary" /> All Testimonials
            </h3>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {testimonials.map((t: any, idx: number) => (
                  <TestimonialCard
                    key={t.id}
                    testimonial={t}
                    isNew={idx === testimonials.length - 1 && !t.student_name}
                    onUpdateField={updateField}
                    onUpdateAndRefresh={updateAndRefresh}
                    onDelete={handleDelete}
                    landingPageId={landingPageId}
                    maxVideoSeconds={maxVideoSeconds}
                  />
                ))}

                <Button
                  variant="outline" size="sm"
                  disabled={limitReached || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                  className="flex items-center gap-1.5 w-full"
                >
                  <Plus size={14} /> Add Testimonial
                </Button>
                {limitReached && (
                  <p className="text-xs text-amber-500">Maximum {MAX_PER_PAGE} testimonials reached.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Testimonial Card ──
const TestimonialCard = memo(({
  testimonial: t, isNew, onUpdateField, onUpdateAndRefresh, onDelete, landingPageId, maxVideoSeconds,
}: {
  testimonial: any;
  isNew: boolean;
  onUpdateField: (id: string, updates: Record<string, any>) => void;
  onUpdateAndRefresh: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  landingPageId: string;
  maxVideoSeconds: number;
}) => {
  const currentType: string = t.type || "text";
  const [textEnabled, setTextEnabled] = useState(currentType === "text" || currentType === "both");
  const [videoEnabled, setVideoEnabled] = useState(currentType === "video" || currentType === "both");
  const rating: number = (t as any).rating ?? 5;
  const placement: string = (t as any).placement || "registration";
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll new card into view
  useEffect(() => {
    if (isNew && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isNew]);

  const handleToggleText = (on: boolean) => {
    setTextEnabled(on);
    const newType = getTestimonialType(on, videoEnabled);
    onUpdateField(t.id, { type: newType });
  };

  const handleToggleVideo = (on: boolean) => {
    setVideoEnabled(on);
    const newType = getTestimonialType(textEnabled, on);
    onUpdateField(t.id, { type: newType });
  };

  const handleRating = (n: number) => {
    onUpdateField(t.id, { rating: n });
  };

  const handlePlacement = (val: string) => {
    onUpdateAndRefresh(t.id, { placement: val });
  };

  const badgeLabel = textEnabled && videoEnabled ? "Text + Video" : videoEnabled ? "Video" : "Text";

  return (
    <div ref={cardRef} className="p-4 bg-muted/50 rounded-xl space-y-3 border border-border">
      {/* Row 1 — Header: drag | badge | visible | delete */}
      <div className="flex items-center gap-2">
        <div className="cursor-grab text-muted-foreground">
          <GripVertical size={16} />
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {badgeLabel}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <Switch
            checked={t.is_active}
            onCheckedChange={(v) => onUpdateAndRefresh(t.id, { is_active: v })}
          />
          <span className="text-[10px] text-muted-foreground">{t.is_active ? "Visible" : "Hidden"}</span>
        </div>
        <Button
          variant="ghost" size="sm"
          className="text-destructive hover:text-destructive h-7 w-7 p-0"
          onClick={() => onDelete(t.id)}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Row 2 — Photo + Name + Location */}
      <div className="flex items-start gap-3">
        <TestimonialPhotoUpload
          value={t.student_photo_url || ""}
          onChange={(url) => onUpdateAndRefresh(t.id, { student_photo_url: url })}
          landingPageId={landingPageId}
          testimonialId={t.id}
          studentName={t.student_name || "Student"}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <DebouncedInput
            value={t.student_name || ""}
            onSave={(val) => onUpdateField(t.id, { student_name: val })}
            placeholder="Full Name *"
            className="bg-muted border-border h-8 text-sm"
            autoFocus={isNew}
          />
          <DebouncedInput
            value={t.student_location || ""}
            onSave={(val) => onUpdateField(t.id, { student_location: val })}
            placeholder="City, Country"
            className="bg-muted border-border h-8 text-sm"
          />
        </div>
      </div>

      {/* Row 3 — Star Rating */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Rating:</span>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" onClick={() => handleRating(s)} className="focus:outline-none">
            <Star size={16} className={s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"} />
          </button>
        ))}
      </div>

      {/* Row 4 — Placement Selector */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Show this testimonial on:</span>
        <div className="flex gap-2">
          {[
            { value: "registration", label: "📋 Registration Page" },
            { value: "after_registration", label: "✅ After Registration" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePlacement(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                placement === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 5 — Content Toggles */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={textEnabled} onCheckedChange={handleToggleText} />
          <span className="text-xs text-muted-foreground">Include Text Review</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch checked={videoEnabled} onCheckedChange={handleToggleVideo} />
          <span className="text-xs text-muted-foreground">Include Video</span>
        </label>
      </div>

      {/* Row 6 — Text Area (animated) */}
      <div className={`overflow-hidden transition-all duration-300 ${textEnabled ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
        <DebouncedTextarea
          value={t.review_text || ""}
          onSave={(val) => onUpdateField(t.id, { review_text: val })}
          placeholder="Their review in their own words..."
          maxLength={300}
          rows={3}
          className="bg-muted border-border text-sm"
        />
      </div>

      {/* Row 7 — Video Upload (animated) */}
      <div className={`overflow-hidden transition-all duration-300 ${videoEnabled ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
        <TestimonialVideoUpload
          testimonialId={t.id}
          landingPageId={landingPageId}
          value={t.video_url || ""}
          thumbnailUrl={t.thumbnail_url || null}
          durationSeconds={t.video_duration_seconds}
          orientation={t.video_orientation || null}
          maxSeconds={maxVideoSeconds}
          onUploaded={({ videoUrl, thumbnailUrl, durationSeconds, videoOrientation, videoWidth, videoHeight }) => {
            onUpdateAndRefresh(t.id, {
              video_url: videoUrl,
              thumbnail_url: thumbnailUrl,
              video_duration_seconds: durationSeconds,
              video_orientation: videoOrientation || 'portrait',
              video_width: videoWidth || null,
              video_height: videoHeight || null,
            });
          }}
          onClear={() => {
            onUpdateAndRefresh(t.id, { video_url: null, thumbnail_url: null, video_duration_seconds: null, video_orientation: 'portrait', video_width: null, video_height: null });
          }}
        />
        {t.video_url && t.video_orientation && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2 ${
            t.video_orientation === 'landscape' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
          }`}>
            {t.video_orientation === 'landscape' ? '🖥 Landscape (16:9)' : '📱 Portrait (9:16)'}
          </span>
        )}
      </div>

      {/* Row 8 — Footer divider */}
      <div className="border-t border-border/50" />
    </div>
  );
});
TestimonialCard.displayName = "TestimonialCard";
