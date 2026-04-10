import { MemberLayout } from "@/components/layout/MemberLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Film, Lock, CheckCircle2, Play, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface MemberHomeProps {
  tab: "program" | "about" | "courses";
}

const MemberHome = ({ tab }: MemberHomeProps) => {
  const { user } = useAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["program-settings-member"],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_settings")
        .select("*")
        .limit(1)
        .single();
      return data;
    },
  });

  // Fetch member content from edge function for program/courses tabs
  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["member-content", tab, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-member-content", {
        body: { type: tab },
      });
      if (error) throw error;
      return data as {
        funnel: { id: string; name: string; description?: string } | null;
        steps: Array<{
          id: string;
          title: string;
          description?: string;
          order: number;
          step_type: string;
          video_url: string | null;
          thumbnail_url: string | null;
          duration_seconds: number | null;
          is_locked: boolean;
          progress: {
            watch_percent: number;
            is_completed: boolean;
            last_position_seconds: number;
          };
        }>;
        overall_completion_percent: number;
      };
    },
    enabled: tab !== "about" && !!user,
  });

  const isLoading = settingsLoading || (tab !== "about" && contentLoading);

  if (isLoading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </MemberLayout>
    );
  }

  // About tab
  if (tab === "about") {
    const aboutTitle = settings?.about_title || "About the Program";
    const aboutContent = settings?.about_content || "";

    return (
      <MemberLayout>
        <div className="max-w-2xl space-y-4">
          <h1 className="text-2xl font-heading font-bold">{aboutTitle}</h1>
          {aboutContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {aboutContent.split("\n").map((line: string, i: number) => (
                <p key={i} className="text-muted-foreground">{line}</p>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground">About content coming soon.</p>
            </div>
          )}
        </div>
      </MemberLayout>
    );
  }

  // Program or Courses tab
  const tabLabel = tab === "program" ? "Your Program" : "Your Courses";
  const funnel = content?.funnel;
  const steps = content?.steps || [];
  const completionPct = content?.overall_completion_percent || 0;
  const completedSteps = steps.filter((s) => s.progress.is_completed).length;

  if (!funnel) {
    return (
      <MemberLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-heading font-bold">{tabLabel}</h1>
          <div className="glass-card p-8 text-center space-y-2">
            <Film size={32} className="mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              {tab === "program"
                ? "Program content is being prepared. Check back soon!"
                : "Courses coming soon."}
            </p>
          </div>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">{tabLabel}</h1>
          {funnel.description && (
            <p className="text-sm text-muted-foreground mt-1">{funnel.description}</p>
          )}
        </div>

        {/* Progress Summary */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedSteps} of {steps.length} steps completed
            </span>
            <span className="font-medium">{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-2" />
        </div>

        {/* Steps List */}
        {steps.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No content yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => {
              const { is_locked: isLocked, progress } = step;
              const isCompleted = progress.is_completed;

              return (
                <div
                  key={step.id}
                  className={`glass-card p-4 flex items-center gap-4 transition-opacity ${
                    isLocked ? "opacity-60" : ""
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                      isCompleted
                        ? "bg-green-500/10 text-green-500"
                        : isLocked
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{step.title}</h3>
                    {step.description && (
                      <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                    )}
                    {!isLocked && !isCompleted && progress.watch_percent > 0 && (
                      <div className="mt-1">
                        <Progress value={progress.watch_percent} className="h-1" />
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isCompleted ? (
                      <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                        <CheckCircle2 size={14} /> Done
                      </span>
                    ) : isLocked ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock size={14} /> Locked
                      </span>
                    ) : (
                      <Button size="sm" variant="hero" className="gap-1.5">
                        <Play size={14} /> {progress.watch_percent > 0 ? "Continue" : "Watch"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberHome;
