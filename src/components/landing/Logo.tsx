export const Logo = ({ size = "default" }: { size?: "sm" | "default" | "lg" }) => {
  const sizes = {
    sm: { icon: "w-6 h-6 text-[11px]", name: "text-[13px]", accent: "text-[13px]" },
    default: { icon: "w-7 h-7 text-[12px]", name: "text-[15px]", accent: "text-[15px]" },
    lg: { icon: "w-8 h-8 text-[14px]", name: "text-[18px]", accent: "text-[18px]" },
  };

  return (
    <div className="flex items-center gap-2">
      {/* Green circle icon with "S" */}
      <div
        className={`${sizes[size].icon} rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground shrink-0`}
      >
        S
      </div>
      <div className="flex items-baseline gap-[3px]">
        <span
          className={sizes[size].name}
          style={{
            fontFamily: "'Plus Jakarta Sans', 'Sora', system-ui, sans-serif",
            fontWeight: 700,
            color: "hsl(var(--foreground))",
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          Smart Income
        </span>
        <span
          className={sizes[size].accent}
          style={{
            fontFamily: "'Plus Jakarta Sans', 'Sora', system-ui, sans-serif",
            fontWeight: 800,
            fontStyle: "italic",
            color: "hsl(var(--primary))",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            transform: "skewX(-6deg) translateX(1px)",
            display: "inline-block",
          }}
        >
          Program
        </span>
      </div>
    </div>
  );
};
