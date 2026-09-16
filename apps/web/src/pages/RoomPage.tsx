import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as monaco from "monaco-editor";
import { MonacoBinding } from "y-monaco";
import type { RuntimeEvent, RuntimeMessage } from "@livepad/shared";
import { authClient } from "../auth-client";
import { getRoom, roomLink } from "../api";
import FileTree from "../components/FileTree";
import ConsolePane from "../components/ConsolePane";
import IntegrityPanel from "../components/IntegrityPanel";
import { colorForName, languageForPath } from "../lib/monaco";
import { useIntegrityReporter } from "../lib/useIntegrityReporter";
import "../lib/monaco";

type Person = { name: string; color: string; role?: string; clientId: number };

export default function RoomPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const urlToken = params.get("token") ?? "";
  const { data: session, isPending } = authClient.useSession();
  const [inviteToken, setInviteToken] = useState(urlToken);
  const [title, setTitle] = useState("Комната");
  const [role, setRole] = useState<"host" | "guest">("guest");
  const [hostName, setHostName] = useState("");
  const [error, setError] = useState("");
  const [guestName, setGuestName] = useState(() => localStorage.getItem("livepad:name") ?? "");
  const [nameOk, setNameOk] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [closedAt, setClosedAt] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    getRoom(slug, urlToken || undefined)
      .then((room) => {
        setTitle(room.title);
        setRole(room.role);
        setInviteToken(room.inviteToken);
        setHostName(room.hostName ?? "");
        setClosedAt(room.closedAt ?? null);
        if (room.role === "host") setNameOk(true);
        else if (localStorage.getItem("livepad:name")) setNameOk(true);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [slug, urlToken, isPending]);

  const displayName = role === "host" ? hostName || session?.user.name || "Интервьюер" : guestName;

  if (!loaded) {
    return <div className="p-8 text-sm text-[#9d9d9d]">Загрузка комнаты...</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="rounded border border-[#3c3c3c] bg-[#252526] p-6">
          <p className="mb-3 text-red-400">{error}</p>
          <Link to="/" className="text-[#4fc1ff]">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  if (!inviteToken || (role === "guest" && !nameOk)) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <form
          className="w-full max-w-sm rounded border border-[#3c3c3c] bg-[#252526] p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const name = guestName.trim();
            if (!name) return;
            localStorage.setItem("livepad:name", name);
            setNameOk(true);
          }}
        >
          <h1 className="mb-2 text-lg text-white">Как тебя зовут?</h1>
          <p className="mb-3 text-sm text-[#9d9d9d]">Это имя увидит интервьюер рядом с курсором.</p>
          <p className="mb-4 text-xs leading-snug text-[#9d9d9d]">
            Организатор видит, когда вкладка Livepad не в фокусе, и крупные вставки в редактор.
          </p>
          <input
            autoFocus
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="mb-4 w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] px-3 py-2 outline-none focus:border-[#0e639c]"
            placeholder="Имя кандидата"
          />
          <button className="w-full rounded bg-[#0e639c] py-2 text-white">Войти в комнату</button>
        </form>
      </div>
    );
  }

  return (
    <Ide
      slug={slug}
      title={title}
      token={inviteToken}
      displayName={displayName}
      role={role}
      closedAt={closedAt}
      copied={copied}
      onCopy={async () => {
        await navigator.clipboard.writeText(roomLink(slug, inviteToken));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    />
  );
}

function Ide({
  slug,
  title,
  token,
  displayName,
  role,
  closedAt,
  copied,
  onCopy,
}: {
  slug: string;
  title: string;
  token: string;
  displayName: string;
  role: "host" | "guest";
  closedAt: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [jobBusy, setJobBusy] = useState(false);
  const [status, setStatus] = useState("подключение...");
  const wsRef = useRef<WebSocket | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  useIntegrityReporter({ enabled: role === "guest", slug, token, name: displayName });

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const color = colorForName(displayName);
    const provider = new HocuspocusProvider({
      url: `ws://${window.location.hostname}:1234`,
      name: slug,
      document: ydoc,
      token,
    });
    providerRef.current = provider;
    provider.on("synced", () => setStatus("онлайн"));
    provider.on("disconnect", () => setStatus("нет связи"));
    provider.awareness.setLocalStateField("user", { name: displayName, color, role });

    const files = ydoc.getMap<Y.Text>("files");
    const refresh = () => {
      const keys = Array.from(files.keys()).sort();
      setPaths(keys);
      setActive((current) => current && keys.includes(current) ? current : keys[0] ?? null);
    };
    files.observe(refresh);
    refresh();

    const onAwareness = () => {
      const next: Person[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        const user = (state as { user?: Omit<Person, "clientId"> }).user;
        if (user?.name) next.push({ ...user, clientId });
      });
      setPeople(next);
    };
    provider.awareness.on("change", onAwareness);
    onAwareness();

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const runtime = new WebSocket(
      `${proto}://${window.location.host}/ws/runtime?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
    );
    wsRef.current = runtime;
    runtime.onmessage = (msg) => {
      const event = JSON.parse(String(msg.data)) as RuntimeEvent;
      if (event.type === "busy") setJobBusy(true);
      if (event.type === "idle") setJobBusy(false);
      setEvents((prev) => {
        if (event.type === "busy") return [...prev, event].slice(-400);
        if (event.type === "idle") return [...prev, event].slice(-400);
        if (event.type === "status" && (event.data.startsWith("npm") || event.data.startsWith("node"))) {
          return [event];
        }
        return [...prev, event].slice(-400);
      });
    };

    return () => {
      files.unobserve(refresh);
      provider.awareness.off("change", onAwareness);
      provider.destroy();
      ydoc.destroy();
      runtime.close();
    };
  }, [slug, token, displayName, role]);

  useEffect(() => {
    if (!editorRef.current || !active || !ydocRef.current || !providerRef.current) return;
    const editor = monaco.editor.create(editorRef.current, {
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 2,
    });
    const ytext = ydocRef.current.getMap<Y.Text>("files").get(active);
    if (!ytext) {
      editor.dispose();
      return;
    }
    const model = monaco.editor.createModel("", languageForPath(active), monaco.Uri.parse(`file:///livepad/${active}`));
    editor.setModel(model);
    const binding = new MonacoBinding(ytext, model, new Set([editor]), providerRef.current.awareness);
    return () => {
      binding.destroy();
      model.dispose();
      editor.dispose();
    };
  }, [active]);

  function send(type: RuntimeMessage) {
    wsRef.current?.send(JSON.stringify({ type }));
  }

  function onCreate() {
    const path = window.prompt("Путь нового файла", "src/app.js");
    if (!path || !ydocRef.current) return;
    const files = ydocRef.current.getMap<Y.Text>("files");
    if (!files.has(path)) files.set(path, new Y.Text());
    setActive(path);
  }

  function onDelete(path: string) {
    if (!ydocRef.current) return;
    if (!window.confirm(`Удалить ${path}?`)) return;
    ydocRef.current.getMap("files").delete(path);
  }

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-[#3c3c3c] bg-[#3c3c3c] px-3 text-sm">
        <Link to="/" className="font-semibold text-white">
          Livepad
        </Link>
        <span className="text-[#cccccc]">{title}</span>
        <span className="text-xs text-[#9d9d9d]">{status}</span>
        <div className="ml-auto flex items-center gap-2">
          {people.map((person) => (
            <span
              key={person.clientId}
              className="rounded-full px-2 py-0.5 text-xs text-black"
              style={{ background: person.color }}
              title={person.role}
            >
              {person.name}
            </span>
          ))}
          <button className="rounded bg-[#0e639c] px-2 py-1 text-xs text-white hover:bg-[#1177bb]" onClick={onCopy}>
            {copied ? "Ссылка скопирована" : "Копировать ссылку"}
          </button>
          <button
            disabled={jobBusy}
            className="rounded bg-[#0e639c] px-2 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
            onClick={() => send("install")}
          >
            Install
          </button>
          <button
            disabled={jobBusy}
            className="rounded bg-[#388a34] px-2 py-1 text-xs text-white hover:bg-[#3f9c3a] disabled:opacity-50"
            onClick={() => send("run")}
          >
            Run
          </button>
          {jobBusy ? (
            <button
              className="rounded bg-[#a1260d] px-2 py-1 text-xs text-white hover:bg-[#c72e12]"
              onClick={() => send("stop")}
            >
              Стоп
            </button>
          ) : null}
        </div>
      </header>
      {role === "host" && closedAt ? (
        <div className="shrink-0 border-b border-[#3c3c3c] bg-[#3a2a2a] px-3 py-1 text-xs text-amber-200">
          Комната закрыта для кандидатов — вы по-прежнему видите код.
        </div>
      ) : null}
      {role === "guest" ? (
        <div className="shrink-0 border-b border-[#3c3c3c] bg-[#2a2d2e] px-3 py-1 text-xs text-[#9d9d9d]">
          Организатор видит фокус вкладки Livepad и крупные вставки в редактор.
        </div>
      ) : null}
      <div
        className={`grid min-h-0 flex-1 grid-rows-[1fr_220px] ${
          role === "host" ? "grid-cols-[220px_1fr_280px]" : "grid-cols-[220px_1fr]"
        }`}
      >
        <div className="row-span-2 border-r border-[#3c3c3c]">
          <FileTree paths={paths} active={active} onOpen={setActive} onCreate={onCreate} onDelete={onDelete} />
        </div>
        <div ref={editorRef} className="min-h-0" />
        {role === "host" ? (
          <div className="row-span-2 min-h-0">
            <IntegrityPanel slug={slug} token={token} />
          </div>
        ) : null}
        <div className="border-t border-[#3c3c3c]">
          <div className="border-b border-[#3c3c3c] bg-[#252526] px-3 py-1 text-xs uppercase tracking-wide text-[#9d9d9d]">
            Консоль
          </div>
          <div className="h-[188px]">
            <ConsolePane events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}
