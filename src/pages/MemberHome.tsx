import { useState } from "react";
import { MemberLayout } from "@/components/layout/MemberLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Film, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeCard } from "@/components/member/WelcomeCard";
import { StepCard, StepData } from "@/components/member/StepCard";
import { VideoPlayer } from "@/components/member/VideoPlayer";
import { CompletionCard } from "@/components/member/CompletionCard";
import { AboutTab } from "@/components/member/AboutTab";

interface MemberHomeProps {
  tab: "program" | "about" | "courses";
}

const MemberHome = ({ tab }: MemberHomeProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

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

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["member-content", tab, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-member-content", {
        body: { type: tab },
      });
      if (error) throw error;
      return data as {
        funnel: { id: string; name: string; description?: string } | null;
        steps: StepData[];
        overall_completion_percent: number;
        streak: number;
        last_active: string | null;
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
    return (
      <MemberLayout>
        <AboutTab settings={settings} />
      </MemberLayout>
    );
  }

  // Program or Courses tab
  const tabTitle = tab === "program"
    ? (settings as any)?.program_tab_title || "Your Program"
    : (settings as any)?.courses_tab_title || "Your Courses";

  const funnel = content?.funnel;
  const steps = content?.steps || [];
  const completionPct = content?.overall_completion_percent || 0;
  const completedSteps = steps.filter((s) => s.progress.is_completed).length;
  const streak = content?.streak || 0;
  const lastActive = content?.last_active || null;
  const allComplete = steps.length > 0 && completedSteps === steps.length;

  const welcomeMessage = (settings as any)?.welcome_message || "Welcome back, [name]! 👋";
  const welcomeTagline = (settings as any)?.welcome_tagline || "Your success journey continues today.";
  const completionMessage = (settings as any)?.completion_message || "Congratulations! You have completed the program.";
  const certificateSignatory = (settings as any)?.certificate_signatory || "";

  if (!funnel) {
    return (
      <MemberLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-heading font-bold">{tabTitle}</h1>
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

  const handleStepComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["member-content", tab, user?.id] });
  };

  return (
    <MemberLayout>
      <div className="space-y-5">
        {/* Welcome card - only on Program tab */}
        {tab === "program" && (
          <WelcomeCard
            welcomeMessage={welcomeMessage}
            welcomeTagline={welcomeTagline}
            completedSteps={completedSteps}
            totalSteps={steps.length}
            completionPct={completionPct}
            streak={streak}
            lastActive={lastActive}
          />
        )}

        {/* Tab title */}
        <div>
          <h1 className="text-xl font-heading font-bold">{tabTitle}</h1>
          {funnel.description && (
            <p className="text-sm text-muted-foreground mt-1">{funnel.description}</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedSteps} of {steps.length} steps completed
            </span>
            <span className="font-medium">{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-1.5" />
        </div>

        {/* Completion celebration */}
        {allComplete ? (
          <CompletionCard
            funnelId={funnel.id}
            programName={funnel.name}
            completionMessage={completionMessage}
            signatory={certificateSignatory}
            totalSteps={steps.length}
          />
        ) : steps.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground">No content yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id}>
                <StepCard
                  step={step}
                  index={index}
                  isExpanded={expandedStepId === step.id}
                  onToggle={() =>
                    setExpandedStepId(expandedStepId === step.id ? null : step.id)
                  }
                />
                {expandedStepId === step.id && !step.is_locked && (
                  <div className="mt-2">
                    <VideoPlayer
                      videoUrl={step.video_url}
                      stepTitle={step.title}
                      stepId={step.id}
                      funnelId={funnel.id}
                      initialPosition={step.progress.last_position_seconds}
                      durationSeconds={step.duration_seconds}
                      onComplete={handleStepComplete}
                      onClose={() => setExpandedStepId(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MemberLayout>
  );
};

export default MemberHome;
