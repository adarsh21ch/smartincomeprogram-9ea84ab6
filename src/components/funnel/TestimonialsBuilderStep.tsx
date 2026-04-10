import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, GripVertical, Star, Loader2, MessageSquare, Video, FileText,
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
const DebouncedInput = memo(({ value: externalValue, onSave, placeholder, className }: {
  value: string; onSave: (val: string) => void; placeholder?: string; className?: string;
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

  return <Input placeholder={placeholder} value={localValue} onChange={handleChange} className={className} />;
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

type TestimonialContentType = "text" | "video" | "both";

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
    mutationFn: async (contentType: TestimonialContentType) => {
      if (!landingPageId) throw new Error("Please save the landing page first.");
      // For "both", we store as "both" type; for text/video store that type
      const { error } = await supabase.from("landing_page_testimonials").insert({
        landing_page_id: landingPageId,
        owner_id: userId,
        type: contentType,
        student_name: "",
        display_order: totalCount,
      });
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
            <p className="text-xs text-muted-foreground mt-0.5">Show testimonials on the post-registration page</p>
          </div>
          <Switch checked={testimonialsEnabled} onCheckedChange={onToggleEnabled} />
        </div>

        <div className={!testimonialsEnabled ? "opacity-50 pointer-events-none" : ""}>
          {/* Display Position */}
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <Label className="font-semibold">Show Testimonials On</Label>
            <p className="text-xs text-muted-foreground">Choose where testimonials appear for visitors.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "registration", label: "Registration Page", desc: "Before form submission" },
                { value: "post_registration", label: "After Registration", desc: "With intro video / confirmation" },
                { value: "both", label: "Both Pages", desc: "Show on both views" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onDisplayPositionChange(opt.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    testimonialsDisplayPosition === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:border-muted-foreground/30"
                  }`}
                >
                  <span className="text-xs font-semibold block">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-xl space-y-2 mt-4">
            <Label>Section Title</Label>
            <Input
              value={testimonialsSectionTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="What our members say"
              className="bg-muted border-border"
            />
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
                {testimonials.map((t: any) => (
                  <TestimonialCard
                    key={t.id}
                    testimonial={t}
                    onUpdateField={updateField}
                    onUpdateAndRefresh={updateAndRefresh}
                    onDelete={handleDelete}
                    landingPageId={landingPageId}
                    maxVideoSeconds={maxVideoSeconds}
                  />
                ))}

                {/* Add testimonial buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={limitReached || addMutation.isPending}
                    onClick={() => addMutation.mutate("text")}
                    className="flex items-center gap-1.5"
                  >
                    <MessageSquare size={13} /> Text
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={limitReached || addMutation.isPending}
                    onClick={() => addMutation.mutate("video")}
                    className="flex items-center gap-1.5"
                  >
                    <Video size={13} /> Video
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={limitReached || addMutation.isPending}
                    onClick={() => addMutation.mutate("both")}
                    className="flex items-center gap-1.5"
                  >
                    <FileText size={13} /> Both
                  </Button>
                </div>
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
  testimonial: t, onUpdateField, onUpdateAndRefresh, onDelete, landingPageId, maxVideoSeconds,
}: {
  testimonial: any;
  onUpdateField: (id: string, updates: Record<string, any>) => void;
  onUpdateAndRefresh: (id: string, updates: Record<string, any>) => void;
  onDelete: (id: string) => void;
  landingPageId: string;
  maxVideoSeconds: number;
}) => {
  const contentType: TestimonialContentType = t.type || "text";
  const showText = contentType === "text" || contentType === "both";
  const showVideo = contentType === "video" || contentType === "both";

  const typeLabel = contentType === "both" ? "Text + Video" : contentType === "video" ? "Video" : "Text";

  return (
    <div className="p-4 bg-muted/50 rounded-xl space-y-3 border border-border">
      <div className="flex items-start gap-3">
        <div className="mt-1 cursor-grab text-muted-foreground">
          <GripVertical size={16} />
        </div>
        <div className="flex-1 space-y-3">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {typeLabel}
            </span>
          </div>

          {/* Photo + name + location */}
          <div className="flex items-start gap-4">
            <TestimonialPhotoUpload
              value={t.student_photo_url || ""}
              onChange={(url) => onUpdateAndRefresh(t.id, { student_photo_url: url })}
              landingPageId={landingPageId}
              testimonialId={t.id}
              studentName={t.student_name || "Student"}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <DebouncedInput
                value={t.student_name || ""}
                onSave={(val) => onUpdateField(t.id, { student_name: val })}
                placeholder="Student name *"
                className="bg-muted border-border h-8 text-sm"
              />
              <DebouncedInput
                value={t.student_location || ""}
                onSave={(val) => onUpdateField(t.id, { student_location: val })}
                placeholder="Location (e.g. Mumbai, India)"
                className="bg-muted border-border h-8 text-sm"
              />
            </div>
          </div>

          {/* Star rating — always 5 stars */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Rating:</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={16} className="fill-amber-400 text-amber-400" />
            ))}
          </div>

          {/* Text section */}
          {showText && (
            <DebouncedTextarea
              value={t.review_text || ""}
              onSave={(val) => onUpdateField(t.id, { review_text: val })}
              placeholder="Write the review text... (max 300 chars)"
              maxLength={300}
              rows={3}
              className="bg-muted border-border text-sm"
            />
          )}

          {/* Video section */}
          {showVideo && (
            <>
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
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  t.video_orientation === 'landscape' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                }`}>
                  {t.video_orientation === 'landscape' ? '🖥 Landscape (16:9)' : '📱 Portrait (9:16)'}
                </span>
              )}
            </>
          )}

          {/* Bottom: active toggle + delete */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={t.is_active}
                onCheckedChange={(v) => onUpdateAndRefresh(t.id, { is_active: v })}
              />
              <span className="text-xs text-muted-foreground">{t.is_active ? "Visible" : "Hidden"}</span>
            </div>
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive h-7"
              onClick={() => onDelete(t.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
TestimonialCard.displayName = "TestimonialCard";
