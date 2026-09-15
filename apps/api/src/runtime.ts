import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { eq } from "drizzle-orm";
import type { RuntimeEvent } from "@livepad/shared";
import { db } from "./db/index.js";
import { rooms, runs } from "./db/schema.js";
import { env } from "./env.js";
import { readRoomFiles } from "./collab.js";
import { resolveEntrypoint } from "./workspace.js";
import { getSessionUser } from "./rooms.js";

const MAX_FILES = 80;
const MAX_FILE_BYTES = 200_000;
const MAX_OUTPUT = 256_000;
const busyRooms = new Set<string>();
const lastOutput = new Map<string, RuntimeEvent[]>();
const sockets = new Map<string, Set<WebSocket>>();

const SAFE_PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\- /]+$/;

function isSafePath(path: string): boolean {
  return Boolean(path) && path.length <= 180 && SAFE_PATH.test(path) && !path.includes("\\");
}

function sanitizeFiles(files: Record<string, string>): Record<string, string> {
  const entries = Object.entries(files);
  if (entries.length === 0) throw new Error("В комнате нет файлов");
  if (entries.length > MAX_FILES) throw new Error("Слишком много файлов");
  const out: Record<string, string> = {};
  for (const [path, content] of entries) {
    if (!isSafePath(path)) throw new Error(`Небезопасный путь файла: ${path}`);
    if (content.length > MAX_FILE_BYTES) throw new Error(`Файл слишком большой: ${path}`);
    out[path] = content;
  }
  return out;
}

function subscribe(slug: string, socket: WebSocket): void {
  let set = sockets.get(slug);
  if (!set) {
    set = new Set();
    sockets.set(slug, set);
  }
  set.add(socket);
}

function unsubscribe(slug: string, socket: WebSocket): void {
  sockets.get(slug)?.delete(socket);
}

function broadcast(slug: string, event: RuntimeEvent): void {
  const history = lastOutput.get(slug) ?? [];
  history.push(event);
  if (history.length > 400) history.splice(0, history.length - 400);
  lastOutput.set(slug, history);
  const raw = JSON.stringify(event);
  for (const socket of sockets.get(slug) ?? []) {
    if (socket.readyState === 1) socket.send(raw);
  }
}

async function canAccessRoom(request: { headers: object; query: unknown }, slug: string): Promise<boolean> {
  const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  if (!room) return false;
  const query = request.query as { token?: string; slug?: string };
  if (query.token && query.token === room.inviteToken) return true;
  const fakeRequest = request as Parameters<typeof getSessionUser>[0];
  const user = await getSessionUser(fakeRequest);
  return Boolean(user && user.id === room.hostUserId);
}

async function runJob(slug: string, action: "install" | "run", startedBy: string): Promise<void> {
  if (busyRooms.has(slug)) {
    broadcast(slug, { type: "error", message: "В этой комнате уже идёт запуск" });
    return;
  }
  const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  if (!room) {
    broadcast(slug, { type: "error", message: "Комната не найдена" });
    return;
  }

  busyRooms.add(slug);
  lastOutput.set(slug, []);
  const runId = randomUUID();
  await db.insert(runs).values({
    id: runId,
    roomId: room.id,
    action,
    status: "running",
    startedBy,
  });

  try {
    const files = sanitizeFiles(await readRoomFiles(slug));
    const entrypoint = action === "run" ? resolveEntrypoint(files) : "index.js";
    broadcast(slug, {
      type: "status",
      data: action === "install" ? "npm install --ignore-scripts\n" : `node ${entrypoint}\n`,
    });

    const response = await fetch(`${env.RUNNER_URL}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomSlug: slug,
        action,
        files,
        entrypoint,
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(text || `Runner HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;

    const consume = (line: string) => {
      if (!line.trim()) return;
      const event = JSON.parse(line) as RuntimeEvent;
      if (event.type === "stdout") {
        stdout = (stdout + event.data).slice(-MAX_OUTPUT);
      }
      if (event.type === "stderr") {
        stderr = (stderr + event.data).slice(-MAX_OUTPUT);
      }
      if (event.type === "exit") {
        exitCode = event.code;
      }
      broadcast(slug, event);
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consume(line);
    }
    if (buffer.trim()) consume(buffer);

    await db
      .update(runs)
      .set({
        status: exitCode === 0 ? "ok" : "error",
        stdout,
        stderr,
        exitCode,
      })
      .where(eq(runs.id, runId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось запустить код";
    broadcast(slug, { type: "error", message });
    await db.update(runs).set({ status: "error", stderr: message }).where(eq(runs.id, runId));
  } finally {
    busyRooms.delete(slug);
  }
}

export async function registerRuntimeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ws/runtime", { websocket: true }, async (socket, request) => {
    const query = request.query as { slug?: string; token?: string };
    const slug = query.slug ?? "";
    if (!slug || !(await canAccessRoom(request, slug))) {
      socket.send(JSON.stringify({ type: "error", message: "Нет доступа к комнате" }));
      socket.close();
      return;
    }

    subscribe(slug, socket);
    for (const event of lastOutput.get(slug) ?? []) {
      socket.send(JSON.stringify(event));
    }

    socket.on("message", async (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string };
        if (msg.type !== "install" && msg.type !== "run") return;
        const user = await getSessionUser(request);
        await runJob(slug, msg.type, user?.email ?? "guest");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ошибка запуска";
        broadcast(slug, { type: "error", message });
      }
    });

    socket.on("close", () => unsubscribe(slug, socket));
  });
}
