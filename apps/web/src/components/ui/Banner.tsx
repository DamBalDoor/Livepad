import type { ReactNode } from "react";
import { Button } from "./Button";

export type BannerTone = "info" | "warning" | "danger" | "muted";

const toneClass: Record<BannerTone, string> = {
  info: "bg-lp-info-muted text-lp-primary border-lp-subtle",
  warning: "bg-lp-warning-muted text-lp-primary border-lp-subtle",
  danger: "bg-lp-danger-muted text-lp-danger border-lp-subtle",
  muted: "bg-lp-muted text-lp-secondary border-lp-subtle",
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
  onAction,
  dismiss,
  onDismiss,
  className = "",
}: {
  tone?: BannerTone;
  title?: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  dismiss?: boolean;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex flex-wrap items-start gap-3 border-b px-4 py-2.5 text-[length:var(--lp-text-sm)] ${toneClass[tone]} ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 font-medium text-lp-primary">{title}</p> : null}
        <div className="text-lp-secondary">{children}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action && onAction ? (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {action}
          </Button>
        ) : null}
        {dismiss && onDismiss ? (
          <button
            type="button"
            className="text-[length:var(--lp-text-xs)] text-lp-muted-text underline hover:text-lp-primary"
            onClick={onDismiss}
          >
            Свернуть
          </button>
        ) : null}
      </div>
    </div>
  );
}
