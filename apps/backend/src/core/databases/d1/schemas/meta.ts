import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const META = sqliteTable('meta', {
    id: text('id').primaryKey().$default(() => crypto.randomUUID()),
    key: text('key').notNull(),
    value: text('value').notNull(),
});

export type Meta = typeof META.$inferSelect;
export type NewMeta = typeof META.$inferInsert;