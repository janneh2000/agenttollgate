import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "accent" | "success" | "warning" | "danger" | "muted";
}

export const Badge: React.FC<BadgeProps> = ({ className, tone = "default", ...props }) => {
  const palette: Record<NonNullable<BadgeProps["tone"]>, string> = {
    default: "border-border bg-surface text-fg",
    accent: "border-accent/40 bg-accent/10 text-accent",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    danger: "border-danger/40 bg-danger/10 text-danger",
    muted: "border-border bg-surface/40 text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        palette[tone],
        className,
      )}
      {...props}
    />
  );
};
