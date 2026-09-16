import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
  customType,
} from "drizzle-orm/mysql-core";

const longBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "longblob";
  },
});

export const user = mysqlTable("user", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const session = mysqlTable("session", {
  id: varchar("id", { length: 36 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = mysqlTable("account", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const verification = mysqlTable("verification", {
  id: varchar("id", { length: 36 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const rooms = mysqlTable(
  "rooms",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    slug: varchar("slug", { length: 32 }).notNull().unique(),
    hostUserId: varchar("host_user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    inviteToken: varchar("invite_token", { length: 64 }).notNull().unique(),
    template: varchar("template", { length: 32 }).notNull().default("node-hello"),
    yjsState: longBlob("yjs_state"),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("rooms_host_idx").on(table.hostUserId)],
);

export const runs = mysqlTable(
  "runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    roomId: varchar("room_id", { length: 36 })
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    stdout: text("stdout"),
    stderr: text("stderr"),
    exitCode: int("exit_code"),
    startedBy: varchar("started_by", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("runs_room_idx").on(table.roomId)],
);

export const integrityEvents = mysqlTable(
  "integrity_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    roomId: varchar("room_id", { length: 36 })
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    payload: text("payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("integrity_room_idx").on(table.roomId)],
);

export type RoomRow = typeof rooms.$inferSelect;
