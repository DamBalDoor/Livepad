import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config({ path: path.resolve(here, "../../.env") });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  API_PORT: z.coerce.number().default(3001),
  COLLAB_PORT: z.coerce.number().default(1234),
  RUNNER_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  API_PORT: process.env.API_PORT,
  COLLAB_PORT: process.env.COLLAB_PORT,
  RUNNER_URL: process.env.RUNNER_URL,
  WEB_ORIGIN: process.env.WEB_ORIGIN,
});
