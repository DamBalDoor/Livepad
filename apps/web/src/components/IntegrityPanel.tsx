import { useEffect, useMemo, useState } from "react";
import type { IntegrityClientState, IntegrityEvent, IntegritySnapshot } from "@livepad/shared";
import { Badge, EmptyState, Panel } from "./ui";
import { copy } from "../lib/copy";

const RECENT_OFFLINE_MS = 15 * 60 * 1000;

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function lastEventAt(events: IntegrityEvent[], clientId: string): number {
  let latest = 0;
  for (const event of events) {
    if (event.clientId !== clientId) continue;
    const t = Date.parse(event.at);
    if (t > latest) latest = t;
  }
  return latest;
}

function feedLabel(event: IntegrityEvent): string {
  switch (event.kind) {
    case "hello":
      return copy.int.hello;
    case "away":
      return copy.int.away;
    case "back":
      return copy.int.back;
    case "paste": {
      const chars = typeof event.meta?.chars === "number" ? event.meta.chars : 0;
      return copy.int.paste(chars);
    }
    case "idle": {
      const mins = typeof event.meta?.minutes === "number" ? event.meta.minutes : 1;
      return copy.int.idle(mins);
    }
    case "active":
      return copy.int.active;
    case "resize":
      return copy.int.resize;
    case "fullscreen":
      return event.message.toLowerCase().includes("включ")
        ? copy.int.fullscreenOn
        : copy.int.fullscreenOff;
    case "devtools":
      return copy.int.devtools;
    case "offline":
      return copy.int.offline;
    default:
      return event.message;
  }
}

function eventTone(event: IntegrityEvent): "neutral" | "warning" | "success" {
  if (event.kind === "devtools" || event.kind === "paste" || event.kind === "away" || event.kind === "idle") {
    return "warning";
  }
  if (event.kind === "hello" || event.kind === "back" || event.kind === "active") return "success";
  return "neutral";
}

export default function IntegrityPanel({ slug, token }: { slug: string; token: string }) {
  const [snapshot, setSnapshot] = useState<IntegritySnapshot>({ clients: [], events: [] });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/integrity?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`,
    );
    ws.onmessage = (msg) => {
      const data = JSON.parse(String(msg.data)) as { type?: string; snapshot?: IntegritySnapshot };
      if (data.type === "snapshot" && data.snapshot) setSnapshot(data.snapshot);
    };
    return () => ws.close();
  }, [slug, token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeClients = useMemo(() => {
    const active: IntegrityClientState[] = [];
    for (const client of snapshot.clients) {
      if (client.online) {
        active.push(client);
        continue;
      }
      const lastAt = lastEventAt(snapshot.events, client.clientId);
      if (lastAt > 0 && now - lastAt <= RECENT_OFFLINE_MS) active.push(client);
    }
    return active;
  }, [snapshot.clients, snapshot.events, now]);

  const events = [...snapshot.events].reverse().slice(0, 80);
  const hasGuest = activeClients.length > 0 || snapshot.events.some((e) => e.kind === "hello");

  return (
    <Panel
      className="border-l border-lp-subtle"
      title={copy.int.panelTitle}
    >
      <p className="border-b border-lp-subtle px-3 py-2 text-[length:var(--lp-text-xs)] text-lp-muted-text">
        {copy.int.panelSubtitle}
      </p>
      <div className="lp-scrollbar min-h-0 flex-1 overflow-auto">
        {!hasGuest ? (
          <EmptyState title={copy.int.empty} />
        ) : (
          activeClients.map((client) => <ClientCard key={client.clientId} client={client} now={now} />)
        )}

        <div className="border-t border-lp-subtle px-3 py-2 text-[length:var(--lp-text-xs)] font-medium text-lp-secondary">
          {copy.int.feedTitle}
        </div>
        <ul className="space-y-2 px-3 pb-4">
          {events.length === 0 ? (
            <li className="text-[length:var(--lp-text-xs)] text-lp-muted-text">{copy.int.feedEmpty}</li>
          ) : (
            events.map((event) => {
              const tone = eventTone(event);
              return (
                <li key={event.id} className="flex gap-2 text-[length:var(--lp-text-xs)] leading-snug">
                  <span className="shrink-0 font-mono text-lp-muted-text">{timeLabel(event.at)}</span>
                  <span
                    className={
                      tone === "warning"
                        ? "text-lp-warning"
                        : tone === "success"
                          ? "text-lp-success"
                          : "text-lp-secondary"
                    }
                  >
                    {feedLabel(event)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Panel>
  );
}

function ClientCard({ client }: { client: IntegrityClientState; now: number }) {
  const inRoom = client.online && client.present;
  return (
    <div className="border-b border-lp-subtle px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[length:var(--lp-text-sm)] font-medium text-lp-primary">{client.name}</span>
        <Badge tone={client.online ? (inRoom ? "success" : "warning") : "neutral"}>
          {!client.online
            ? copy.int.statusOffline
            : inRoom
              ? copy.int.metricTabActive
              : copy.int.metricTabAway}
        </Badge>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[length:var(--lp-text-xs)] text-lp-muted-text">
        <dt>Крупные вставки</dt>
        <dd className="text-lp-secondary">{client.largePasteCount}</dd>
        <dt>Последняя вставка</dt>
        <dd className="font-mono text-lp-secondary">
          {client.lastPasteChars == null ? "—" : `${client.lastPasteChars} симв.`}
        </dd>
        <dt>Мониторы</dt>
        <dd className="text-lp-secondary">
          {client.multiMonitor == null ? "—" : client.multiMonitor ? `>1` : "1"}
        </dd>
        <dt>Бездействие</dt>
        <dd className="text-lp-secondary">
          {client.idle ? copy.int.metricIdle : copy.int.metricEditorActive}
        </dd>
        <dt>{copy.int.metricLocale}</dt>
        <dd className="max-w-[140px] truncate text-right text-lp-secondary">
          {[client.timezone, client.language].filter(Boolean).join(" · ") || "—"}
        </dd>
        <dt>DevTools</dt>
        <dd>
          {client.devtools ? (
            <Badge tone="warning">{copy.int.devtools}</Badge>
          ) : (
            <span className="text-lp-secondary">—</span>
          )}
        </dd>
      </dl>
    </div>
  );
}
