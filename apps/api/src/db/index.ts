import mysql from "mysql2/promise";
import { env } from "../env.js";
import * as schema from "./schema.js";
import { drizzle } from "drizzle-orm/mysql2";

const pool = mysql.createPool(env.DATABASE_URL);

export const db = drizzle({ client: pool, schema, mode: "default" });

export async function waitForDb(retries = 40): Promise<void> {
  for (let i = 0; i < retries; i += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("MySQL is not reachable. Start it with: docker compose up -d mysql");
}
