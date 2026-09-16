import type { ButtonHTMLAttributes, ReactNode } from "react";

type Size = "sm" | "md";

const sizeClass: Record<Size, string> = {
  sm: "size-7",
  md: "size-8",
};

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: Size;
  children: ReactNode;
};

export function IconButton({
  label,
  size = "sm",
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lp-sm text-lp-secondary transition-colors hover:bg-lp-muted ${sizeClass[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
