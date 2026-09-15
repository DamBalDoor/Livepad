import Fastify from "fastify";
import { executeJob, type JobEvent } from "./docker.js";

const PORT = Number(process.env.PORT ?? 4000);

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

app.post("/jobs", async (request, reply) => {
  const body = request.body as {
    roomSlug?: string;
    action?: "install" | "run";
    files?: Record<string, string>;
    entrypoint?: string;
  };
  if (!body.roomSlug || !body.action || !body.files) {
    return reply.code(400).send({ error: "roomSlug, action и files обязательны" });
  }

  reply.hijack();
  reply.raw.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const write = (event: JobEvent) => {
    reply.raw.write(`${JSON.stringify(event)}\n`);
  };

  try {
    await executeJob({
      roomSlug: body.roomSlug,
      action: body.action,
      files: body.files,
      entrypoint: body.entrypoint ?? "index.js",
      onEvent: write,
    });
  } catch (error) {
    write({
      type: "error",
      message: error instanceof Error ? error.message : "Ошибка runner",
    });
    write({ type: "exit", code: 1 });
  } finally {
    reply.raw.end();
  }
});

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(`Runner http://127.0.0.1:${PORT}`);
});
