import { cn } from "@/lib/utils";

interface CharCountProps {
  value: string;
  max: number;
  className?: string;
}

export function CharCount({ value, max, className }: CharCountProps) {
  const len = (value || "").length;
  const pct = len / max;
  const tone =
    pct >= 1 ? "text-destructive" : pct >= 0.85 ? "text-amber-500" : "text-muted-foreground";
  return (
    <span className={cn("text-[10px] tabular-nums", tone, className)}>
      {len}/{max}
    </span>
  );
}
