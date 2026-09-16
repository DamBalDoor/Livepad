import { useMemo, useState } from "react";
import { Button, EmptyState, IconButton, Input, Panel } from "./ui";
import { ConfirmModal } from "./ui/Modal";
import { copy } from "../lib/copy";

type Props = {
  paths: string[];
  active: string | null;
  readOnly?: boolean;
  onOpen: (path: string) => void;
  onCreate: () => void;
  onDelete: (path: string) => void;
};

export default function FileTree({ paths, active, readOnly, onOpen, onCreate, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const visible = useMemo(
    () => paths.filter((p) => p.toLowerCase().includes(query.toLowerCase())),
    [paths, query],
  );

  return (
    <Panel
      className="border-r border-lp-subtle"
      title={copy.files.title}
      actions={
        readOnly ? null : (
          <Button variant="ghost" size="sm" onClick={onCreate}>
            {copy.files.add}
          </Button>
        )
      }
    >
      <Input
        size="sm"
        className="border-b border-lp-subtle px-3 py-2"
        placeholder={copy.files.filterPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {paths.length === 0 ? (
        <EmptyState
          title={copy.files.empty}
          action={readOnly ? undefined : copy.files.add}
          onAction={readOnly ? undefined : onCreate}
        />
      ) : (
        <ul className="lp-scrollbar flex-1 overflow-auto py-1 text-[length:var(--lp-text-sm)]">
          {visible.length === 0 ? (
            <li className="px-3 py-4 text-[length:var(--lp-text-xs)] text-lp-muted-text">Ничего не найдено</li>
          ) : (
            visible.map((path) => (
              <li key={path} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => onOpen(path)}
                  className={`flex-1 truncate px-3 py-1.5 text-left font-mono hover:bg-lp-muted ${
                    active === path ? "bg-lp-accent-muted text-lp-primary" : "text-lp-secondary"
                  }`}
                >
                  {path}
                </button>
                {!readOnly ? (
                  <IconButton
                    label="Удалить файл"
                    className="mr-1 opacity-0 group-hover:opacity-100"
                    onClick={() => setDeletePath(path)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </IconButton>
                ) : null}
              </li>
            ))
          )}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(deletePath)}
        title="Удалить файл"
        body={deletePath ? copy.files.deleteConfirm(deletePath) : ""}
        confirmLabel={copy.files.deleteCta}
        cancelLabel={copy.files.deleteCancel}
        danger
        onCancel={() => setDeletePath(null)}
        onConfirm={() => {
          if (deletePath) onDelete(deletePath);
          setDeletePath(null);
        }}
      />
    </Panel>
  );
}
