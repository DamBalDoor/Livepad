import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "./auth.js";
import { db } from "./db/index.js";
import { rooms } from "./db/schema.js";

const createRoomBody = z.object({
  title: z.string().trim().min(1).max(80).default("Комната"),
});

export async function getSessionUser(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  return session?.user ?? null;
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
    });
    return {
      id,
      slug,
      title: body.title,
      inviteToken,
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
      };
    }
    if (token && token === room.inviteToken) {
      return {
        slug: room.slug,
        title: room.title,
        role: "guest" as const,
        inviteToken: room.inviteToken,
      };
    }
    return reply.code(401).send({ error: "Нужна ссылка-приглашение или вход как организатор" });
  });
}
