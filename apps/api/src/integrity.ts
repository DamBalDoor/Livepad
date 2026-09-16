import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { desc, eq } from "drizzle-orm";
import type { IntegrityClientState, IntegrityEvent, IntegrityEventKind, IntegritySnapshot } from "@livepad/shared";
import { db } from "./db/index.js";
import { integrityEvents, rooms } from "./db/schema.js";
import { getSessionUser } from "./rooms.js";

const MAX_EVENTS = 250;
const hostSockets = new Map<string, Set<WebSocket>>();
const roomState = new Map<string, Map<string, IntegrityClientState>>();
const roomEvents = new Map<string, IntegrityEvent[]>();

type Gate = { roomId: string; isHost: boolean };

async function gate(request: { headers: object; query: unknown }, slug: string): Promise<Gate | null> {
  const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  if (!room) return null;
  const query = request.query as { token?: string };
  const user = await getSessionUser(request as Parameters<typeof getSessionUser>[0]);
  const isHost = Boolean(user && user.id === room.hostUserId);
  if (room.closedAt && !isHost) return null;
  const isGuest = Boolean(query.token && query.token === room.inviteToken);
  if (!isHost && !isGuest) return null;
  return { roomId: room.id, isHost };
}

function emptyClient(clientId: string, name: string): IntegrityClientState {
  return {
    clientId,
    name,
    present: true,
    online: true,
    awayStartedAt: null,
    leaveCount: 0,
    awayMs: 0,
    largePasteCount: 0,
    lastPasteChars: null,
    lastPasteAfterAway: false,
    idle: false,
    multiMonitor: null,
    screen: "",
    timezone: "",
    language: "",
    userAgent: "",
    fullscreen: false,
    devtools: null,
  };
}

function snapshot(slug: string): IntegritySnapshot {
  return {
    clients: [...(roomState.get(slug)?.values() ?? [])],
    events: roomEvents.get(slug) ?? [],
  };
}

function sendHosts(slug: string): void {
  const raw = JSON.stringify({ type: "snapshot", snapshot: snapshot(slug) });
  for (const socket of hostSockets.get(slug) ?? []) {
    if (socket.readyState === 1) socket.send(raw);
  }
}

async function remember(slug: string, roomId: string, event: IntegrityEvent): Promise<void> {
  const list = roomEvents.get(slug) ?? [];
  list.push(event);
  if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
  roomEvents.set(slug, list);
  await db.insert(integrityEvents).values({
    id: event.id,
    roomId,
    clientId: event.clientId,
    displayName: event.name,
    kind: event.kind,
    message: event.message.slice(0, 500),
    payload: event.meta ? JSON.stringify(event.meta).slice(0, 2000) : null,
  });
}

function applyEvent(state: IntegrityClientState, event: IntegrityEvent): void {
  state.name = event.name || state.name;
  state.online = event.kind !== "offline";
  const meta = event.meta ?? {};
  if (typeof meta.multiMonitor === "boolean") state.multiMonitor = meta.multiMonitor;
  if (typeof meta.screen === "string") state.screen = meta.screen;
  if (typeof meta.timezone === "string") state.timezone = meta.timezone;
  if (typeof meta.language === "string") state.language = meta.language;
  if (typeof meta.userAgent === "string") state.userAgent = meta.userAgent;
  if (typeof meta.fullscreen === "boolean") state.fullscreen = meta.fullscreen;
  if (typeof meta.devtools === "boolean") state.devtools = meta.devtools;

  if (event.kind === "hello") {
    state.online = true;
    state.present = true;
    state.awayStartedAt = null;
  }
  if (event.kind === "away") {
    if (state.present) {
      state.present = false;
      state.leaveCount += 1;
      state.awayStartedAt = event.at;
    }
  }
  if (event.kind === "back") {
    if (!state.present && state.awayStartedAt) {
      state.awayMs += Math.max(0, Date.parse(event.at) - Date.parse(state.awayStartedAt));
    }
    state.present = true;
    state.awayStartedAt = null;
  }
  if (event.kind === "paste") {
    const chars = typeof meta.chars === "number" ? meta.chars : 0;
    state.lastPasteChars = chars;
    state.lastPasteAfterAway = Boolean(meta.afterAway);
    if (meta.large === true) state.largePasteCount += 1;
  }
  if (event.kind === "idle") state.idle = true;
  if (event.kind === "active") state.idle = false;
  if (event.kind === "offline") {
    state.online = false;
    state.present = false;
  }
}

async function loadHistory(slug: string, roomId: string): Promise<void> {
  if (roomEvents.has(slug)) return;
  const rows = await db
    .select()
    .from(integrityEvents)
    .where(eq(integrityEvents.roomId, roomId))
    .orderBy(desc(integrityEvents.createdAt))
    .limit(MAX_EVENTS);
  const events: IntegrityEvent[] = rows
    .reverse()
    .map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      clientId: row.clientId,
      name: row.displayName,
      kind: row.kind as IntegrityEventKind,
      message: row.message,
      meta: row.payload ? (JSON.parse(row.payload) as IntegrityEvent["meta"]) : undefined,
    }));
  roomEvents.set(slug, events);
  const clients = new Map<string, IntegrityClientState>();
  for (const event of events) {
    const current = clients.get(event.clientId) ?? emptyClient(event.clientId, event.name);
    applyEvent(current, event);
    clients.set(event.clientId, current);
  }
  for (const current of clients.values()) {
    current.online = false;
    current.present = false;
    current.awayStartedAt = null;
  }
  roomState.set(slug, clients);
}

export async function registerIntegrityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ws/integrity", { websocket: true }, async (socket, request) => {
    const query = request.query as { slug?: string; token?: string };
    const slug = query.slug ?? "";
    const access = slug ? await gate(request, slug) : null;
    if (!access) {
      socket.send(JSON.stringify({ type: "error", message: "Нет доступа" }));
      socket.close();
      return;
    }

    await loadHistory(slug, access.roomId);

    if (access.isHost) {
      let set = hostSockets.get(slug);
      if (!set) {
        set = new Set();
        hostSockets.set(slug, set);
      }
      set.add(socket);
      socket.send(JSON.stringify({ type: "snapshot", snapshot: snapshot(slug) }));
      socket.on("close", () => hostSockets.get(slug)?.delete(socket));
      return;
    }

    let guestClientId: string | null = null;

    socket.on("message", async (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          type?: string;
          clientId?: string;
          name?: string;
          kind?: IntegrityEventKind;
          message?: string;
          meta?: IntegrityEvent["meta"];
          at?: string;
        };
        if (msg.type !== "event" || !msg.clientId || !msg.kind || !msg.message) return;
        guestClientId = String(msg.clientId).slice(0, 64);
        const event: IntegrityEvent = {
          id: randomUUID(),
          at: msg.at && !Number.isNaN(Date.parse(msg.at)) ? msg.at : new Date().toISOString(),
          clientId: guestClientId,
          name: String(msg.name ?? "Кандидат").slice(0, 80),
          kind: msg.kind,
          message: String(msg.message).slice(0, 500),
          meta: msg.meta,
        };
        const clients = roomState.get(slug) ?? new Map();
        const state = clients.get(event.clientId) ?? emptyClient(event.clientId, event.name);
        applyEvent(state, event);
        clients.set(event.clientId, state);
        roomState.set(slug, clients);
        await remember(slug, access.roomId, event);
        sendHosts(slug);
      } catch {
        // ignore malformed guest events
      }
    });

    socket.on("close", async () => {
      if (!guestClientId) return;
      const clients = roomState.get(slug);
      const state = clients?.get(guestClientId);
      if (!state || !state.online) return;
      const event: IntegrityEvent = {
        id: randomUUID(),
        at: new Date().toISOString(),
        clientId: guestClientId,
        name: state.name,
        kind: "offline",
        message: `${state.name} отключился`,
      };
      applyEvent(state, event);
      await remember(slug, access.roomId, event);
      sendHosts(slug);
    });
  });
}
