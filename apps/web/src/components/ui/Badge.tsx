import type { ReactNode } from "react";
import { copy } from "../../lib/copy";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-lp-muted text-lp-secondary",
  success: "bg-lp-success-muted text-lp-success",
  warning: "bg-lp-warning-muted text-lp-warning",
  danger: "bg-lp-danger-muted text-lp-danger",
  info: "bg-lp-info-muted text-lp-info",
  accent: "bg-lp-accent-muted text-lp-accent-text",
};

export function Badge({
  children,
  tone = "neutral",
  dot,
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-lp-sm px-2 py-0.5 text-[length:var(--lp-text-xs)] font-medium ${toneClass[tone]} ${className}`}
    >
      {dot ? (
        <span
          className={`size-1.5 shrink-0 rounded-full ${tone === "success" ? "bg-lp-success" : tone === "danger" ? "bg-lp-danger" : tone === "info" ? "bg-lp-info" : tone === "warning" ? "bg-lp-warning" : "bg-lp-secondary"}`}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

export function CollabBadge({ state }: { state: "connecting" | "synced" | "disconnected" }) {
  const map = {
    connecting: { tone: "info" as const, label: copy.collab.connecting },
    synced: { tone: "success" as const, label: copy.collab.synced },
    disconnected: { tone: "danger" as const, label: copy.collab.disconnected },
  };
  const { tone, label } = map[state];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function RunnerBadge({
  state,
}: {
  state: "idle" | "busy-install" | "busy-run" | "failed";
}) {
  const map = {
    idle: { tone: "neutral" as const, label: copy.runner.idle },
    "busy-install": { tone: "warning" as const, label: copy.runner.busyInstall },
    "busy-run": { tone: "warning" as const, label: copy.runner.busyRun },
    failed: { tone: "danger" as const, label: copy.runner.failedBadge },
  };
  const { tone, label } = map[state];
  return (
    <Badge tone={tone} dot={state !== "idle"}>
      {label}
    </Badge>
  );
}
