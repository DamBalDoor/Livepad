import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import type { RoomTemplate } from "@livepad/shared";
import { auth } from "./auth.js";
import { db } from "./db/index.js";
import { rooms } from "./db/schema.js";

const createRoomBody = z.object({
  title: z.string().trim().min(1).max(80).default("Комната"),
  template: z.enum(["node-hello", "empty"]).default("node-hello"),
});

export async function getSessionUser(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  return session?.user ?? null;
}

async function requireHostRoom(request: FastifyRequest, slug: string) {
  const user = await getSessionUser(request);
  if (!user) return null;
  const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
  if (!room || room.hostUserId !== user.id) return null;
  return { room, user };
}

export async function registerRoomRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/rooms", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) {
      return reply.code(401).send({ error: "Нужна авторизация" });
    }
    const rows = await db
      .select()
      .from(rooms)
      .where(eq(rooms.hostUserId, user.id))
      .orderBy(desc(rooms.createdAt));
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      inviteToken: row.inviteToken,
      template: row.template as RoomTemplate,
      closedAt: row.closedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  });

  app.post("/api/rooms", async (request, reply) => {
    const user = await getSessionUser(request);
    if (!user) {
      return reply.code(401).send({ error: "Нужна авторизация" });
    }
    const body = createRoomBody.parse(request.body ?? {});
    const id = randomUUID();
    const slug = nanoid(10);
    const inviteToken = nanoid(24);
    await db.insert(rooms).values({
      id,
      slug,
      hostUserId: user.id,
      title: body.title,
      inviteToken,
      template: body.template,
    });
    return {
      id,
      slug,
      title: body.title,
      inviteToken,
      template: body.template,
      closedAt: null,
      createdAt: new Date().toISOString(),
    };
  });

  app.get("/api/rooms/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const token = typeof request.query === "object" && request.query && "token" in request.query
      ? String((request.query as { token?: string }).token ?? "")
      : "";
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, slug)).limit(1);
    if (!room) {
      return reply.code(404).send({ error: "Комната не найдена" });
    }

    const user = await getSessionUser(request);
    if (user && user.id === room.hostUserId) {
      return {
        slug: room.slug,
        title: room.title,
        role: "host" as const,
        inviteToken: room.inviteToken,
        hostName: user.name,
        closedAt: room.closedAt?.toISOString() ?? null,
      };
    }
    if (room.closedAt) {
      return reply.code(403).send({ error: "Комната закрыта организатором" });
    }
    if (token && token === room.inviteToken) {
      return {
        slug: room.slug,
        title: room.title,
        role: "guest" as const,
        inviteToken: room.inviteToken,
        closedAt: null,
      };
    }
    return reply.code(401).send({ error: "Нужна ссылка-приглашение или вход как организатор" });
  });

  app.post("/api/rooms/:slug/rotate-invite", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const access = await requireHostRoom(request, slug);
    if (!access) {
      return reply.code(403).send({ error: "Только организатор комнаты" });
    }
    const inviteToken = nanoid(24);
    await db.update(rooms).set({ inviteToken, updatedAt: new Date() }).where(eq(rooms.id, access.room.id));
    return { slug, inviteToken };
  });

  app.post("/api/rooms/:slug/close", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const access = await requireHostRoom(request, slug);
    if (!access) {
      return reply.code(403).send({ error: "Только организатор комнаты" });
    }
    if (access.room.closedAt) {
      return { slug, closedAt: access.room.closedAt.toISOString() };
    }
    const closedAt = new Date();
    await db.update(rooms).set({ closedAt, updatedAt: closedAt }).where(eq(rooms.id, access.room.id));
    return { slug, closedAt: closedAt.toISOString() };
  });
}
