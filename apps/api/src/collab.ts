import { eq } from "drizzle-orm";
import * as Y from "yjs";
import { Database } from "@hocuspocus/extension-database";
import { Server } from "@hocuspocus/server";
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
        seedWorkspace(doc);
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
  async onAuthenticate({ token, documentName }) {
    if (!token) {
      throw new Error("Нужен токен комнаты");
    }
    const [room] = await db.select().from(rooms).where(eq(rooms.slug, documentName)).limit(1);
    if (!room || room.inviteToken !== token) {
      throw new Error("Нет доступа к комнате");
    }
    return { slug: documentName };
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
