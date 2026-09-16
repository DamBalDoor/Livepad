import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-lp-accent text-lp-inverse hover:bg-lp-accent-hover border-transparent",
  secondary:
    "bg-lp-surface text-lp-primary border-lp-subtle hover:border-lp-strong hover:bg-lp-muted",
  ghost: "bg-transparent text-lp-secondary border-transparent hover:bg-lp-muted",
  danger: "bg-lp-danger text-lp-inverse hover:opacity-90 border-transparent",
  "danger-ghost":
    "bg-transparent text-lp-danger border-transparent hover:bg-lp-danger-muted",
};

const sizeClass: Record<Size, string> = {
  sm: "h-7 min-h-7 px-2.5 text-[length:var(--lp-text-sm)] gap-1.5",
  md: "h-9 min-h-9 px-3.5 text-[length:var(--lp-text-md)] gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  busy,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center rounded-lp-md border font-medium transition-colors duration-[var(--lp-duration-fast)] disabled:pointer-events-none disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {busy ? <span className="lp-spinner shrink-0" aria-hidden /> : null}
      {children}
    </button>
  );
}
