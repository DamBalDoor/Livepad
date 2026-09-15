import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { env } from "./env.js";
import { auth } from "./auth.js";
import { waitForDb } from "./db/index.js";
import { collabServer } from "./collab.js";
import { registerRoomRoutes } from "./rooms.js";
import { registerRuntimeRoutes } from "./runtime.js";
import { registerIntegrityRoutes } from "./integrity.js";

function incomingToRequest(request: {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  protocol: string;
  body: unknown;
}): Request {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url, `${request.protocol}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body ?? {});
  return new Request(url, { method, headers, body });
}

async function main(): Promise<void> {
  await waitForDb();

  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(websocket);

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (request, reply) => {
      const response = await auth.handler(incomingToRequest(request));
      reply.status(response.status);
      const cookies =
        typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
      if (cookies.length > 0) {
        reply.header("set-cookie", cookies);
      }
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        reply.header(key, value);
      });
      const text = await response.text();
      if (text) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          try {
            return reply.send(JSON.parse(text));
          } catch {
            return reply.send(text);
          }
        }
        return reply.send(text);
      }
      return reply.send();
    },
  });

  await registerRoomRoutes(app);
  await registerRuntimeRoutes(app);
  await registerIntegrityRoutes(app);

  app.get("/api/health", async () => ({ ok: true }));

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  await collabServer.listen();
  app.log.info(`API http://127.0.0.1:${env.API_PORT}`);
  app.log.info(`Collab ws://127.0.0.1:${env.COLLAB_PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
