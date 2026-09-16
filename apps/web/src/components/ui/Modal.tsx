import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Отмена",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="absolute inset-0 bg-[rgba(26,26,24,0.4)]" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-modal-title"
        className="relative z-10 w-full max-w-[440px] rounded-lp-lg border border-lp-subtle bg-lp-elevated p-6 shadow-lp-md"
      >
        <h2 id="lp-modal-title" className="mb-2 text-[length:var(--lp-text-lg)] font-semibold text-lp-primary">
          {title}
        </h2>
        <div className="mb-6 text-[length:var(--lp-text-md)] text-lp-secondary">{body}</div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="md"
            busy={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PromptModal({
  open,
  title,
  defaultValue,
  confirmLabel,
  cancelLabel = "Отмена",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  defaultValue: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <ConfirmModal
      open
      title={title}
      body={
        <input
          ref={inputRef}
          defaultValue={defaultValue}
          className="mt-2 w-full rounded-lp-md border border-lp-strong bg-lp-surface px-3 py-2 font-mono text-[length:var(--lp-text-sm)] outline-none focus:border-lp-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onConfirm((e.target as HTMLInputElement).value);
            }
          }}
        />
      }
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      onConfirm={() => onConfirm(inputRef.current?.value ?? defaultValue)}
    />
  );
}
