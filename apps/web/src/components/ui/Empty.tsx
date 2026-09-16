import type { ReactNode } from "react";
import { Button } from "./Button";

export function EmptyState({
  title,
  description,
  action,
  onAction,
  icon,
}: {
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon ?? (
        <svg
          className="mb-3 text-lp-muted-text"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 12h8" />
        </svg>
      )}
      <p className="text-[length:var(--lp-text-md)] font-medium text-lp-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[length:var(--lp-text-sm)] text-lp-secondary">{description}</p>
      ) : null}
      {action && onAction ? (
        <Button className="mt-4" size="md" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
