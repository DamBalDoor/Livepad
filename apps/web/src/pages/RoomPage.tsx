import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as monaco from "monaco-editor";
import { MonacoBinding } from "y-monaco";
import type { RuntimeAction, RuntimeEvent, RuntimeMessage } from "@livepad/shared";
import { authClient } from "../auth-client";
import { closeRoom, getRoom, roomLink, rotateInvite } from "../api";
import FileTree from "../components/FileTree";
import ConsolePane from "../components/ConsolePane";
import IntegrityPanel from "../components/IntegrityPanel";
import {
  AuthShell,
  Banner,
  Button,
  Card,
  Checkbox,
  CollabBadge,
  ConfirmModal,
  FieldGroup,
  Input,
  PageCanvas,
  PromptModal,
  RunnerBadge,
} from "../components/ui";
import { useToast } from "../components/ui/Toast";
import { colorForName, languageForPath } from "../lib/monaco";
import { useIntegrityReporter } from "../lib/useIntegrityReporter";
import { copy } from "../lib/copy";
import "../lib/monaco";

type Person = { name: string; color: string; role?: string; clientId: number };
type CollabState = "connecting" | "synced" | "disconnected";
type RunnerUiState = "idle" | "busy-install" | "busy-run" | "failed";

export default function RoomPage() {
  const navigate = useNavigate();
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
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [preflightDone, setPreflightDone] = useState(() => sessionStorage.getItem(`livepad:preflight:${slug}`) === "1");
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [closedAt, setClosedAt] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    setError("");
    getRoom(slug, urlToken || undefined)
      .then((room) => {
        setTitle(room.title);
        setRole(room.role);
        setInviteToken(room.inviteToken);
        setHostName(room.hostName ?? "");
        setClosedAt(room.closedAt ?? null);
        if (room.role === "host") {
          setPreflightDone(true);
        }
      })
      .catch((err: Error) => {
        const msg = err.message.toLowerCase();
        if (msg.includes("closed") || msg.includes("закрыт") || msg.includes("заверш")) {
          setError(copy.invite.errorClosed);
        } else {
          setError(copy.invite.errorAccess);
        }
      })
      .finally(() => setLoaded(true));
  }, [slug, urlToken, isPending]);

  const hostCookieConflict = loaded && role === "host" && Boolean(urlToken);

  if (!loaded || isPending) {
    return (
      <PageCanvas>
        <p className="p-8 text-[length:var(--lp-text-sm)] text-lp-muted-text">{copy.invite.loading}</p>
      </PageCanvas>
    );
  }

  if (hostCookieConflict) {
    return (
      <AuthShell>
        <Card>
          <Banner tone="warning" className="mb-4 rounded-lp-md border">
            {copy.invite.errorHostCookie}
          </Banner>
          <p className="mb-4 text-[length:var(--lp-text-sm)] text-lp-secondary">{copy.invite.errorHostCookieHint}</p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" className="w-full" onClick={() => navigate(`/r/${slug}`)}>
              {copy.invite.enterAsHost}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(roomLink(slug, inviteToken));
              }}
            >
              {copy.invite.copyGuestLinkForIncognito}
            </Button>
          </div>
          <Link to="/" className="mt-4 block text-center text-[length:var(--lp-text-sm)] text-lp-accent">
            {copy.invite.backToDash}
          </Link>
        </Card>
      </AuthShell>
    );
  }

  if (error) {
    return (
      <AuthShell>
        <Card>
          <p className="mb-4 text-[length:var(--lp-text-md)] text-lp-danger" role="alert">
            {error}
          </p>
          <Link to="/" className="text-[length:var(--lp-text-sm)] font-medium text-lp-accent hover:underline">
            На главную
          </Link>
        </Card>
      </AuthShell>
    );
  }

  if (role === "guest" && closedAt) {
    return (
      <AuthShell>
        <Card>
          <p className="text-[length:var(--lp-text-md)] text-lp-secondary">{copy.invite.errorClosed}</p>
        </Card>
      </AuthShell>
    );
  }

  if (role === "guest" && (!preflightDone || !guestName.trim())) {
    return (
      <GuestPreflight
        guestName={guestName}
        consent={consent}
        consentError={consentError}
        onName={setGuestName}
        onConsent={setConsent}
        onSubmit={() => {
          const name = guestName.trim();
          if (!name) return;
          if (!consent) {
            setConsentError(copy.preflight.consentError);
            return;
          }
          setConsentError("");
          localStorage.setItem("livepad:name", name);
          sessionStorage.setItem(`livepad:preflight:${slug}`, "1");
          setPreflightDone(true);
        }}
      />
    );
  }

  const displayName =
    role === "host" ? hostName || session?.user.name || "Интервьюер" : guestName.trim();

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
      onClosed={(at) => setClosedAt(at)}
      onRotated={(tok) => setInviteToken(tok)}
    />
  );
}

function GuestPreflight({
  guestName,
  consent,
  consentError,
  onName,
  onConsent,
  onSubmit,
}: {
  guestName: string;
  consent: boolean;
  consentError: string;
  onName: (v: string) => void;
  onConsent: (v: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <PageCanvas className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-[480px]" as="form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h1 className="mb-2 text-[length:var(--lp-text-xl)] font-semibold text-lp-primary">{copy.preflight.title}</h1>
        <p className="mb-4 text-[length:var(--lp-text-md)] text-lp-secondary">{copy.preflight.lead}</p>
        <ul className="mb-6 list-disc space-y-2 pl-5 text-[length:var(--lp-text-sm)] text-lp-secondary">
          <li>{copy.preflight.metrics.focus}</li>
          <li>{copy.preflight.metrics.paste}</li>
          <li>{copy.preflight.metrics.idle}</li>
          <li>{copy.preflight.metrics.window}</li>
          <li>{copy.preflight.metrics.devtools}</li>
          <li>{copy.preflight.metrics.presence}</li>
          <li>{copy.preflight.metrics.timezone}</li>
          <li>{copy.preflight.metrics.language}</li>
          <li>{copy.preflight.metrics.screen}</li>
          <li>{copy.preflight.metrics.multiMonitor}</li>
        </ul>
        <FieldGroup>
          <Input
            label={copy.preflight.nameLabel}
            placeholder={copy.preflight.namePlaceholder}
            value={guestName}
            onChange={(e) => onName(e.target.value)}
            autoFocus
            required
          />
          <Checkbox
            checked={consent}
            onChange={(e) => onConsent(e.target.checked)}
            label={copy.preflight.consent}
            error={consentError}
          />
        </FieldGroup>
        <Button type="submit" className="mt-6 w-full" disabled={!guestName.trim() || !consent}>
          {copy.preflight.cta}
        </Button>
      </Card>
    </PageCanvas>
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
  onClosed,
  onRotated,
}: {
  slug: string;
  title: string;
  token: string;
  displayName: string;
  role: "host" | "guest";
  closedAt: string | null;
  copied: boolean;
  onCopy: () => void;
  onClosed: (closedAt: string) => void;
  onRotated: (token: string) => void;
}) {
  const readOnly = Boolean(closedAt);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [runnerBusy, setRunnerBusy] = useState<RuntimeAction | null>(null);
  const [runnerFailed, setRunnerFailed] = useState(false);
  const [collab, setCollab] = useState<CollabState>("connecting");
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeCompact, setNoticeCompact] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [rotateBusy, setRotateBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const { push: toast } = useToast();

  useIntegrityReporter({
    enabled: role === "guest" && !readOnly,
    slug,
    token,
    name: displayName,
    onLocalSignal: (kind) => {
      if (kind === "away") toast(copy.guest.toastAway);
    },
  });

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const color = colorForName(displayName);
    setCollab("connecting");
    const provider = new HocuspocusProvider({
      url: `ws://${window.location.hostname}:1234`,
      name: slug,
      document: ydoc,
      token,
    });
    providerRef.current = provider;
    provider.on("synced", () => setCollab("synced"));
    provider.on("disconnect", () => setCollab("disconnected"));
    provider.on("connect", () => setCollab("connecting"));
    const awareness = provider.awareness;
    if (!awareness) {
      provider.destroy();
      ydoc.destroy();
      return;
    }
    awareness.setLocalStateField("user", { name: displayName, color, role });

    const files = ydoc.getMap<Y.Text>("files");
    const refresh = () => {
      const keys = Array.from(files.keys()).sort();
      setPaths(keys);
      setActive((current) => (current && keys.includes(current) ? current : keys[0] ?? null));
    };
    files.observe(refresh);
    refresh();

    const onAwareness = () => {
      const next: Person[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const user = (state as { user?: Omit<Person, "clientId"> }).user;
        if (user?.name) next.push({ ...user, clientId });
      });
      setPeople(next);
    };
    awareness.on("change", onAwareness);
    onAwareness();

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const runtime = new WebSocket(
      `${proto}://${window.location.host}/ws/runtime?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
    );
    wsRef.current = runtime;
    runtime.onmessage = (msg) => {
      const event = JSON.parse(String(msg.data)) as RuntimeEvent;
      if (event.type === "busy") {
        setRunnerBusy(event.action);
        setRunnerFailed(false);
      }
      if (event.type === "idle") {
        setRunnerBusy(null);
        setRunnerFailed(false);
      }
      if (event.type === "exit" && event.code !== 0) {
        setRunnerFailed(true);
      }
      setEvents((prev) => {
        if (event.type === "busy" || event.type === "idle") return [...prev, event].slice(-400);
        if (event.type === "status" && (event.data.startsWith("npm") || event.data.startsWith("node"))) {
          return [event];
        }
        return [...prev, event].slice(-400);
      });
    };

    return () => {
      files.unobserve(refresh);
      awareness.off("change", onAwareness);
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
      readOnly: readOnly || collab === "disconnected",
    });
    editorInstance.current = editor;
    const ytext = ydocRef.current.getMap<Y.Text>("files").get(active);
    if (!ytext) {
      editor.dispose();
      editorInstance.current = null;
      return;
    }
    const model = monaco.editor.createModel("", languageForPath(active), monaco.Uri.parse(`file:///livepad/${active}`));
    editor.setModel(model);
    const binding = new MonacoBinding(ytext, model, new Set([editor]), providerRef.current!.awareness!);
    return () => {
      binding.destroy();
      model.dispose();
      editor.dispose();
      editorInstance.current = null;
    };
  }, [active, readOnly, collab]);

  useEffect(() => {
    editorInstance.current?.updateOptions({ readOnly: readOnly || collab === "disconnected" });
  }, [readOnly, collab]);

  function send(type: RuntimeMessage) {
    wsRef.current?.send(JSON.stringify({ type }));
  }

  function onCreatePath(path: string) {
    if (!path || !ydocRef.current || readOnly) return;
    const files = ydocRef.current.getMap<Y.Text>("files");
    if (!files.has(path)) files.set(path, new Y.Text());
    setActive(path);
  }

  function onDelete(path: string) {
    if (!ydocRef.current || readOnly) return;
    ydocRef.current.getMap("files").delete(path);
  }

  const runnerUi: RunnerUiState = runnerBusy === "install"
    ? "busy-install"
    : runnerBusy === "run"
      ? "busy-run"
      : runnerFailed
        ? "failed"
        : "idle";

  const runnerControlsDisabled = readOnly || Boolean(runnerBusy) || collab === "disconnected";

  async function handleCloseRoom() {
    setCloseBusy(true);
    try {
      const res = await closeRoom(slug);
      onClosed(res.closedAt);
      setCloseOpen(false);
    } finally {
      setCloseBusy(false);
    }
  }

  async function handleRotateInvite() {
    setRotateBusy(true);
    setMenuOpen(false);
    try {
      const res = await rotateInvite(slug);
      onRotated(res.inviteToken);
      await navigator.clipboard.writeText(roomLink(slug, res.inviteToken));
      toast(copy.invite.rotateDone);
    } finally {
      setRotateBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-lp-surface">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-lp-subtle bg-lp-surface px-3 text-[length:var(--lp-text-sm)]">
        <Link to="/" className="font-semibold text-lp-primary">
          Livepad
        </Link>
        <span className="hidden truncate text-lp-secondary sm:inline">{title}</span>
        <div className="hidden h-4 w-px bg-lp-subtle sm:block" />
        <CollabBadge state={collab} />
        <RunnerBadge state={runnerUi} />
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {people.map((person) => (
            <span
              key={person.clientId}
              className="max-w-[120px] truncate rounded-lp-sm bg-lp-muted px-2 py-0.5 text-[length:var(--lp-text-xs)] text-lp-secondary"
              title={person.role === "host" ? "Host" : "Гость"}
            >
              {person.name}
            </span>
          ))}
          {role === "host" ? (
            <>
              <Button variant="secondary" size="sm" onClick={onCopy}>
                {copied ? copy.room.copyLinkDone : copy.room.copyLink}
              </Button>
              <div className="relative">
                <Button variant="ghost" size="sm" onClick={() => setMenuOpen((v) => !v)}>
                  ⋯
                </Button>
                {menuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lp-md border border-lp-subtle bg-lp-elevated py-1 shadow-lp-sm">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-[length:var(--lp-text-sm)] hover:bg-lp-muted disabled:opacity-50"
                      disabled={rotateBusy || readOnly}
                      onClick={handleRotateInvite}
                    >
                      {copy.invite.rotateCta}
                    </button>
                    <p className="px-3 pb-1 text-[length:var(--lp-text-xs)] text-lp-muted-text">{copy.invite.rotateHint}</p>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[length:var(--lp-text-sm)] text-lp-danger hover:bg-lp-danger-muted"
                        onClick={() => {
                          setMenuOpen(false);
                          setCloseOpen(true);
                        }}
                      >
                        {copy.room.closeCta}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            disabled={runnerControlsDisabled}
            busy={runnerBusy === "install"}
            title={copy.runner.sharedTooltip}
            onClick={() => send("install")}
          >
            {copy.runner.install}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={runnerControlsDisabled}
            busy={runnerBusy === "run"}
            title={copy.runner.sharedTooltip}
            onClick={() => send("run")}
          >
            {copy.runner.run}
          </Button>
          {runnerBusy ? (
            <Button variant="danger-ghost" size="sm" onClick={() => send("stop")}>
              {copy.runner.stop}
            </Button>
          ) : null}
        </div>
      </header>

      {readOnly ? (
        <Banner tone="muted">
          {role === "host" ? copy.room.closedHostView : copy.room.closedBanner}
        </Banner>
      ) : null}

      {collab === "disconnected" ? (
        <Banner
          tone="danger"
          title={copy.collab.disconnected}
          action={copy.collab.disconnectedCta}
          onAction={() => window.location.reload()}
        >
          {copy.collab.disconnectedHint}
        </Banner>
      ) : null}

      {role === "guest" ? (
        noticeCompact ? (
          <Banner tone="info">
            {copy.guest.noticeTitle}
            <button
              type="button"
              className="ml-2 text-lp-accent underline"
              onClick={() => setNoticeCompact(false)}
            >
              {copy.guest.noticeExpand}
            </button>
          </Banner>
        ) : (
          <Banner tone="info" title={copy.guest.noticeTitle} dismiss onDismiss={() => setNoticeCompact(true)}>
            {copy.guest.noticeBody}
          </Banner>
        )
      ) : null}

      <div
        className={`grid min-h-0 flex-1 grid-rows-[1fr_minmax(180px,220px)] ${
          role === "host" ? "grid-cols-[minmax(220px,240px)_1fr_minmax(280px,320px)]" : "grid-cols-[minmax(220px,240px)_1fr]"
        }`}
      >
        <div className="row-span-2 min-h-0">
          <FileTree
            paths={paths}
            active={active}
            readOnly={readOnly}
            onOpen={setActive}
            onCreate={() => setCreateOpen(true)}
            onDelete={onDelete}
          />
        </div>
        <div ref={editorRef} className="min-h-0 border-b border-lp-editor-border bg-lp-editor" />
        {role === "host" ? (
          <div className="row-span-2 min-h-0">
            <IntegrityPanel slug={slug} token={token} />
          </div>
        ) : null}
        <div className="min-h-0 border-t border-lp-subtle">
          <ConsolePane events={events} onClear={() => setEvents([])} />
        </div>
      </div>

      <ConfirmModal
        open={closeOpen}
        title={copy.room.closeCta}
        body={copy.room.closeConfirm}
        confirmLabel={copy.room.closeCta}
        danger
        busy={closeBusy}
        onCancel={() => setCloseOpen(false)}
        onConfirm={handleCloseRoom}
      />

      <PromptModal
        open={createOpen}
        title={copy.files.add}
        defaultValue="src/app.js"
        confirmLabel={copy.files.add}
        onCancel={() => setCreateOpen(false)}
        onConfirm={(path) => {
          onCreatePath(path.trim());
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
