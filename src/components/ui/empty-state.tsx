import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 rounded-2xl border border-dashed border-border bg-muted/20",
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="text-primary" size={24} />
      </div>
      <h3 className="font-heading font-semibold text-base">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button variant="hero" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
