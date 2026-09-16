import { useEffect, useMemo, useState } from "react";
import type { IntegrityClientState, IntegrityEvent, IntegritySnapshot } from "@livepad/shared";

const RECENT_OFFLINE_MS = 15 * 60 * 1000;

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

function currentAwayMs(client: IntegrityClientState, now: number): number {
  if (client.present || !client.awayStartedAt) return 0;
  return Math.max(0, now - Date.parse(client.awayStartedAt));
}

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

function eventLabel(event: IntegrityEvent): string {
  if (event.kind === "back" && typeof event.meta?.awayMs === "number" && event.meta.awayMs > 0) {
    const sec = Math.round(event.meta.awayMs / 1000);
    return `${event.name} вернулся (был вне вкладки ${sec < 60 ? `${sec} с` : formatDuration(event.meta.awayMs)})`;
  }
  return event.message;
}

export default function IntegrityPanel({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [snapshot, setSnapshot] = useState<IntegritySnapshot>({ clients: [], events: [] });
  const [now, setNow] = useState(Date.now());
  const [showPast, setShowPast] = useState(false);

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

  const { activeClients, pastClients } = useMemo(() => {
    const active: IntegrityClientState[] = [];
    const past: IntegrityClientState[] = [];
    for (const client of snapshot.clients) {
      if (client.online) {
        active.push(client);
        continue;
      }
      const lastAt = lastEventAt(snapshot.events, client.clientId);
      if (lastAt > 0 && now - lastAt <= RECENT_OFFLINE_MS) {
        active.push(client);
      } else {
        past.push(client);
      }
    }
    return { activeClients: active, pastClients: past };
  }, [snapshot.clients, snapshot.events, now]);

  const events = [...snapshot.events].reverse().slice(0, 80);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-[#3c3c3c] bg-[#252526] text-[#cccccc]">
      <div className="border-b border-[#3c3c3c] px-3 py-2 text-xs uppercase tracking-wide text-[#9d9d9d]">
        Кандидат
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {activeClients.length === 0 && pastClients.length === 0 ? (
          <p className="px-3 py-4 text-xs text-[#9d9d9d]">Пока нет сигналов — кандидат ещё не в комнате.</p>
        ) : (
          activeClients.map((client) => (
            <ClientCard key={client.clientId} client={client} now={now} />
          ))
        )}
        {pastClients.length > 0 ? (
          <div className="border-b border-[#3c3c3c] px-3 py-2">
            <button
              type="button"
              className="text-xs text-[#9d9d9d] hover:text-[#cccccc]"
              onClick={() => setShowPast((v) => !v)}
            >
              {showPast ? "Скрыть" : "Показать"} прошлых ({pastClients.length})
            </button>
            {showPast ? (
              <ul className="mt-2 space-y-1 text-xs text-[#9d9d9d]">
                {pastClients.map((client) => (
                  <li key={client.clientId}>{client.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="border-t border-[#3c3c3c] px-3 py-2 text-xs uppercase tracking-wide text-[#9d9d9d]">
          Лента
        </div>
        <ul className="space-y-1 px-3 pb-3 text-xs">
          {events.length === 0 ? (
            <li className="text-[#9d9d9d]">Пусто</li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="leading-snug">
                <span className="text-[#9d9d9d]">{timeLabel(event.at)} </span>
                <span className={tone(event)}>{eventLabel(event)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}

function tone(event: IntegrityEvent): string {
  if (event.kind === "paste" && event.meta?.large) return "text-amber-300";
  if (event.kind === "away") return "text-amber-300";
  if (event.kind === "offline" || event.kind === "devtools") return "text-red-300";
  if (event.kind === "back" || event.kind === "hello") return "text-emerald-300";
  return "text-[#cccccc]";
}

function ClientCard({ client, now }: { client: IntegrityClientState; now: number }) {
  const awayNow = currentAwayMs(client, now);
  const awayTotal = client.awayMs + awayNow;
  const inRoom = client.online && client.present;
  return (
    <div className="border-b border-[#3c3c3c] px-3 py-3 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-white">{client.name}</span>
        <span className={`rounded px-1.5 py-0.5 ${inRoom ? "bg-emerald-900 text-emerald-200" : "bg-amber-900 text-amber-200"}`}>
          {!client.online ? "офлайн" : inRoom ? "в Livepad" : `ушёл ${formatDuration(awayNow)}`}
        </span>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[#9d9d9d]">
        <dt>Уходы</dt>
        <dd className="text-[#cccccc]">{client.leaveCount}</dd>
        <dt>Вне вкладки</dt>
        <dd className="text-[#cccccc]">{formatDuration(awayTotal)}</dd>
        <dt>Крупные вставки</dt>
        <dd className="text-[#cccccc]">{client.largePasteCount}</dd>
        <dt>Последняя паста</dt>
        <dd className="text-[#cccccc]">
          {client.lastPasteChars == null ? "—" : `${client.lastPasteChars} симв.${client.lastPasteAfterAway ? " после ухода" : ""}`}
        </dd>
        <dt>Мониторы</dt>
        <dd className="text-[#cccccc]">
          {client.multiMonitor == null ? "неизвестно" : client.multiMonitor ? "больше одного" : "один"}
        </dd>
        <dt>Экран</dt>
        <dd className="max-w-[140px] truncate text-right text-[#cccccc]" title={client.screen}>
          {client.screen || "—"}
        </dd>
        <dt>Простой</dt>
        <dd className="text-[#cccccc]">{client.idle ? "не печатает" : "активен"}</dd>
        <dt>Пояс / язык</dt>
        <dd className="max-w-[140px] truncate text-right text-[#cccccc]">
          {[client.timezone, client.language].filter(Boolean).join(" · ") || "—"}
        </dd>
        <dt>DevTools</dt>
        <dd className="text-[#cccccc]">
          {client.devtools == null ? "—" : client.devtools ? "возможно да" : "не видно"}
        </dd>
      </dl>
    </div>
  );
}
