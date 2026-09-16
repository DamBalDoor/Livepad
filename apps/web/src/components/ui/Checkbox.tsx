import type { InputHTMLAttributes, ReactNode } from "react";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  error?: string;
};

export function Checkbox({ label, error, className = "", id, ...rest }: CheckboxProps) {
  const inputId = id ?? "lp-checkbox";
  return (
    <div className={className}>
      <label htmlFor={inputId} className="flex cursor-pointer items-start gap-3 py-1">
        <input
          id={inputId}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded-lp-sm border-lp-strong accent-lp-accent"
          {...rest}
        />
        <span className="text-[length:var(--lp-text-md)] text-lp-primary">{label}</span>
      </label>
      {error ? (
        <p className="mt-1 pl-7 text-[length:var(--lp-text-xs)] text-lp-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
