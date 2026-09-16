import type { InputHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { IconButton } from "./IconButton";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  error?: string;
  hint?: string;
  size?: "sm" | "md";
};

export function Input({
  label,
  error,
  hint,
  size: fieldSize = "md",
  className = "",
  id,
  type,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, "-").toLowerCase();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const height = fieldSize === "sm" ? "h-7 text-[length:var(--lp-text-sm)]" : "h-9 text-[length:var(--lp-text-md)]";

  return (
    <div className={`block ${className}`}>
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-[length:var(--lp-text-sm)] font-medium text-lp-secondary">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && showPassword ? "text" : type}
          className={`w-full rounded-lp-md border bg-lp-surface px-3 outline-none transition-colors placeholder:text-lp-muted-text focus:border-lp-accent ${height} ${
            error ? "border-lp-danger" : "border-lp-strong"
          } ${isPassword ? "pr-10" : ""}`}
          {...rest}
        />
        {isPassword ? (
          <IconButton
            type="button"
            label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            className="absolute right-0.5 top-1/2 -translate-y-1/2"
            onClick={() => setShowPassword((v) => !v)}
          >
            <EyeIcon open={showPassword} />
          </IconButton>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-[length:var(--lp-text-xs)] text-lp-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-[length:var(--lp-text-xs)] text-lp-muted-text">{hint}</p>
      ) : null}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      {open ? (
        <path d="M3 3l18 18M10.5 10.5a3 3 0 0 0 4.24 4.24M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7.5a11.8 11.8 0 0 1-2.12 3.5M6.12 6.12A11.8 11.8 0 0 0 3 12.5C4.73 16.39 9 19.5 14 19.5c1.05 0 2.06-.14 3-.4" />
      ) : (
        <>
          <path d="M2 12.5C3.73 8.61 8 5.5 13 5.5s9.27 3.11 11 7.5c-1.73 3.89-6 7-11 7S3.73 16.39 2 12.5z" />
          <circle cx="13" cy="12.5" r="3" />
        </>
      )}
    </svg>
  );
}

export function Textarea({
  label,
  error,
  className = "",
  id,
  ...rest
}: InputHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const inputId = id ?? label?.replace(/\s/g, "-").toLowerCase();
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={inputId} className="mb-1 block text-[length:var(--lp-text-sm)] font-medium text-lp-secondary">
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        className={`min-h-20 w-full resize-y rounded-lp-md border bg-lp-surface px-3 py-2 text-[length:var(--lp-text-md)] outline-none focus:border-lp-accent ${
          error ? "border-lp-danger" : "border-lp-strong"
        }`}
        {...rest}
      />
      {error ? <p className="mt-1 text-[length:var(--lp-text-xs)] text-lp-danger">{error}</p> : null}
    </div>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
