import { useMemo, useState } from "react";

type Props = {
  paths: string[];
  active: string | null;
  onOpen: (path: string) => void;
  onCreate: () => void;
  onDelete: (path: string) => void;
};

export default function FileTree({ paths, active, onOpen, onCreate, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => paths.filter((p) => p.toLowerCase().includes(query.toLowerCase())),
    [paths, query],
  );

  return (
    <div className="flex h-full flex-col bg-[#252526] text-[#cccccc]">
      <div className="flex items-center justify-between border-b border-[#3c3c3c] px-3 py-2 text-xs uppercase tracking-wide text-[#9d9d9d]">
        Файлы
        <button className="rounded px-1.5 py-0.5 text-[11px] normal-case text-[#4fc1ff] hover:bg-[#2a2a2a]" onClick={onCreate}>
          + файл
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="фильтр"
        className="border-b border-[#3c3c3c] bg-transparent px-3 py-1.5 text-xs outline-none"
      />
      <ul className="flex-1 overflow-auto py-1 text-sm">
        {visible.map((path) => (
          <li key={path} className="group flex items-center">
            <button
              onClick={() => onOpen(path)}
              className={`flex-1 truncate px-3 py-1 text-left hover:bg-[#2a2d2e] ${active === path ? "bg-[#37373d] text-white" : ""}`}
            >
              {path}
            </button>
            <button
              className="hidden px-2 text-xs text-[#9d9d9d] group-hover:block hover:text-red-400"
              onClick={() => onDelete(path)}
              title="Удалить"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
