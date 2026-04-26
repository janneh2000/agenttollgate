"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  code,
  lang = "ts",
  className,
  caption,
}: {
  code: string;
  lang?: string;
  className?: string;
  caption?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className={cn("card overflow-hidden p-0 group", className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg/60">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 text-xs text-muted">{caption ?? lang}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs text-muted hover:text-fg flex items-center gap-1"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-auto text-fg/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
