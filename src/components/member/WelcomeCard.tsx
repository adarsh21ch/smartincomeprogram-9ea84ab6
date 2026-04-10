import { useAuth } from "@/hooks/useAuth";

interface WelcomeCardProps {
  welcomeMessage: string;
  welcomeTagline: string;
  completedSteps: number;
  totalSteps: number;
  completionPct: number;
  streak: number;
  lastActive: string | null;
}

export const WelcomeCard = ({
  welcomeMessage,
  welcomeTagline,
  completedSteps,
  totalSteps,
  completionPct,
  streak,
  lastActive,
}: WelcomeCardProps) => {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "Member";

  const displayMessage = welcomeMessage.replace("[name]", firstName);

  const streakLabel =
    streak >= 30
      ? `💎 ${streak} day streak — incredible!`
      : streak >= 7
      ? `🔥 ${streak} day streak — on fire!`
      : streak >= 2
      ? `🔥 ${streak} day streak`
      : "🌱 Just getting started!";

  const lastActiveLabel = lastActive
    ? `📅 Last active: ${new Date(lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : null;

  // SVG progress ring
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPct / 100) * circumference;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 p-5 flex flex-col md:flex-row items-center gap-5">
      <div className="flex-1 min-w-0">
        <h2 className="text-xl font-heading font-semibold text-foreground">{displayMessage}</h2>
        <p className="text-sm text-muted-foreground mt-1">{welcomeTagline}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {streakLabel}
          </span>
          {lastActiveLabel && (
            <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
              {lastActiveLabel}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-center">
        <svg width="100" height="100" className="-rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <span className="absolute text-lg font-bold text-foreground" style={{ marginTop: 32 }}>
          {completionPct}%
        </span>
        <p className="text-xs text-muted-foreground mt-1">{completedSteps} of {totalSteps} done</p>
      </div>
    </div>
  );
};
