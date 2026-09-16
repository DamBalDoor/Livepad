import { eq } from "drizzle-orm";
import * as Y from "yjs";
import { Database } from "@hocuspocus/extension-database";
import { Server } from "@hocuspocus/server";
import { fromNodeHeaders } from "better-auth/node";
import type { RoomTemplate } from "@livepad/shared";
import { auth } from "./auth.js";
import { env } from "./env.js";
import { db } from "./db/index.js";
import { rooms } from "./db/schema.js";
import { seedWorkspace, yDocToFiles } from "./workspace.js";

export const collabServer = new Server({
  port: env.COLLAB_PORT,
  address: "0.0.0.0",
  name: "livepad-collab",
  timeout: 30_000,
  debounce: 2_000,
  maxDebounce: 10_000,
  quiet: true,
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const [room] = await db.select().from(rooms).where(eq(rooms.slug, documentName)).limit(1);
        if (room?.yjsState) {
          return new Uint8Array(room.yjsState);
        }
        const doc = new Y.Doc();
        seedWorkspace(doc, (room?.template ?? "node-hello") as RoomTemplate);
        return Y.encodeStateAsUpdate(doc);
      },
      store: async ({ documentName, state }) => {
        await db
          .update(rooms)
          .set({ yjsState: Buffer.from(state), updatedAt: new Date() })
          .where(eq(rooms.slug, documentName));
      },
    }),
  ],
  async onAuthenticate({ token, documentName, requestHeaders }) {
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, documentName)).limit(1);
    if (!room) {
      throw new Error("Комната не найдена");
    }

    const headers = fromNodeHeaders(requestHeaders ?? {});
    const session = await auth.api.getSession({ headers });
    const isHost = Boolean(session?.user?.id && session.user.id === room.hostUserId);

    if (room.closedAt && !isHost) {
      throw new Error("Комната закрыта");
    }

    if (isHost) {
      return { slug: documentName, role: "host" };
    }

    if (!token || room.inviteToken !== token) {
      throw new Error("Нет доступа к комнате");
    }

    return { slug: documentName, role: "guest" };
  },
});

export async function readRoomFiles(slug: string): Promise<Record<string, string>> {
  const connection = await collabServer.hocuspocus.openDirectConnection(slug, { source: "runner" });
  try {
    let files: Record<string, string> = {};
    await connection.transact((document) => {
      files = yDocToFiles(document);
    });
    return files;
  } finally {
    await connection.disconnect();
  }
}
