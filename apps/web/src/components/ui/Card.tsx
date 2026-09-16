import type { HTMLAttributes, ReactNode } from "react";
import { ThemeToggle } from "../ThemeToggle";

export function Card({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "form" | "section";
} & HTMLAttributes<HTMLDivElement & HTMLFormElement & HTMLElement>) {
  return (
    <Tag
      className={`rounded-lp-lg border border-lp-subtle bg-lp-surface p-6 shadow-lp-sm ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Panel({
  children,
  className = "",
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`flex h-full min-h-0 flex-col bg-lp-surface ${className}`}>
      {title ? (
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-lp-subtle px-3">
          <span className="text-[length:var(--lp-text-sm)] font-medium text-lp-secondary">{title}</span>
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-full items-center justify-center bg-lp-canvas p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}

export function PageCanvas({
  children,
  className = "",
  themeCorner = false,
}: {
  children: ReactNode;
  className?: string;
  themeCorner?: boolean;
}) {
  return (
    <div className={`relative min-h-full bg-lp-canvas text-lp-primary ${className}`}>
      {themeCorner ? (
        <div className="absolute right-4 top-4 z-10">
          <ThemeToggle />
        </div>
      ) : null}
      {children}
    </div>
  );
}
