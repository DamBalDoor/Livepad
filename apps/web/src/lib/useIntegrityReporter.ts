import { useEffect, useRef } from "react";
import type { IntegrityEventKind } from "@livepad/shared";

const IDLE_MS = 45_000;
const LARGE_PASTE = 80;
const AWAY_PASTE_MS = 15_000;

function clientId(): string {
  const key = "livepad:clientId";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
}

function screenLabel(): string {
  return `${window.screen.width}×${window.screen.height}, окно ${window.innerWidth}×${window.innerHeight}`;
}

function multiMonitor(): boolean | null {
  if (!("isExtended" in window.screen)) return null;
  return Boolean((window.screen as Screen & { isExtended?: boolean }).isExtended);
}

function isPresent(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function devtoolsOpen(): boolean {
  const gap = 160;
  return window.outerWidth - window.innerWidth > gap || window.outerHeight - window.innerHeight > gap;
}

type Payload = {
  type: "event";
  clientId: string;
  name: string;
  kind: IntegrityEventKind;
  message: string;
  at: string;
  meta?: Record<string, string | number | boolean | null>;
};

export function useIntegrityReporter(opts: {
  enabled: boolean;
  slug: string;
  token: string;
  name: string;
}): void {
  const nameRef = useRef(opts.name);
  nameRef.current = opts.name;

  useEffect(() => {
    if (!opts.enabled) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/integrity?slug=${encodeURIComponent(opts.slug)}&token=${encodeURIComponent(opts.token)}`,
    );
    const id = clientId();
    let present = isPresent();
    let idle = false;
    let lastActivity = Date.now();
    let lastBackAt = 0;
    let lastDevtools: boolean | null = null;
    let lastFullscreen = Boolean(document.fullscreenElement);
    let closed = false;

    const send = (kind: IntegrityEventKind, message: string, meta?: Payload["meta"]) => {
      if (closed || ws.readyState !== WebSocket.OPEN) return;
      const payload: Payload = {
        type: "event",
        clientId: id,
        name: nameRef.current,
        kind,
        message,
        at: new Date().toISOString(),
        meta,
      };
      ws.send(JSON.stringify(payload));
    };

    const envMeta = () => ({
      multiMonitor: multiMonitor(),
      screen: screenLabel(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      userAgent: navigator.userAgent.slice(0, 180),
      fullscreen: Boolean(document.fullscreenElement),
      devtools: devtoolsOpen(),
    });

    const onOpen = () => {
      present = isPresent();
      send("hello", `${nameRef.current} в комнате`, envMeta());
      if (!present) {
        send("away", `${nameRef.current} ушёл с вкладки Livepad`, envMeta());
      }
    };

    const onPresence = () => {
      const next = isPresent();
      if (next === present) return;
      present = next;
      if (!next) {
        send("away", `${nameRef.current} ушёл с вкладки Livepad`, envMeta());
        return;
      }
      lastBackAt = Date.now();
      send("back", `${nameRef.current} вернулся в Livepad`, envMeta());
    };

    const bumpActivity = () => {
      lastActivity = Date.now();
      if (idle) {
        idle = false;
        send("active", `${nameRef.current} снова активен в редакторе`);
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text") ?? "";
      if (!text) return;
      const chars = text.length;
      const lines = text.split("\n").length;
      const large = chars >= LARGE_PASTE || lines >= 4;
      const afterAway = lastBackAt > 0 && Date.now() - lastBackAt < AWAY_PASTE_MS;
      send("paste", large
        ? `${nameRef.current} вставил ${chars} символов${afterAway ? " сразу после возвращения" : ""}`
        : `${nameRef.current} вставил ${chars} символов`, {
        chars,
        lines,
        large,
        afterAway,
        ...envMeta(),
      });
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        send("resize", `Окно: ${window.innerWidth}×${window.innerHeight}`, envMeta());
      }, 800);
    };

    const onFullscreen = () => {
      const full = Boolean(document.fullscreenElement);
      if (full === lastFullscreen) return;
      lastFullscreen = full;
      send("fullscreen", full ? "Включён полноэкранный режим" : "Вышел из полноэкранного режима", envMeta());
    };

    ws.addEventListener("open", onOpen);
    window.addEventListener("focus", onPresence);
    window.addEventListener("blur", onPresence);
    document.addEventListener("visibilitychange", onPresence);
    window.addEventListener("paste", onPaste, true);
    window.addEventListener("keydown", bumpActivity, true);
    window.addEventListener("pointermove", bumpActivity);
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFullscreen);

    const idleTimer = window.setInterval(() => {
      if (!present) return;
      if (!idle && Date.now() - lastActivity >= IDLE_MS) {
        idle = true;
        send("idle", `${nameRef.current} не печатает уже ${Math.round(IDLE_MS / 1000)}с`);
      }
      const dt = devtoolsOpen();
      if (dt !== lastDevtools) {
        lastDevtools = dt;
        send("devtools", dt ? "Возможно открыт DevTools (эвристика)" : "Окно без явного DevTools", {
          ...envMeta(),
          devtools: dt,
        });
      }
    }, 2000);

    return () => {
      closed = true;
      window.clearTimeout(resizeTimer);
      window.clearInterval(idleTimer);
      ws.removeEventListener("open", onOpen);
      window.removeEventListener("focus", onPresence);
      window.removeEventListener("blur", onPresence);
      document.removeEventListener("visibilitychange", onPresence);
      window.removeEventListener("paste", onPaste, true);
      window.removeEventListener("keydown", bumpActivity, true);
      window.removeEventListener("pointermove", bumpActivity);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFullscreen);
      ws.close();
    };
  }, [opts.enabled, opts.slug, opts.token]);
}
