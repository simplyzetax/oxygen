import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const cacheTable = sqliteTable("cache", {
    key: text("key").primaryKey().notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at").notNull(),
});

export type DrizzleCache = typeof cacheTable.$inferSelect;
export type NewDrizzleCache = typeof cacheTable.$inferInsert;