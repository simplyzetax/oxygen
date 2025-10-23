import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ACCOUNTS = sqliteTable('account', {
    id: text('id').primaryKey().$default(() => crypto.randomUUID()),
    email: text('email').notNull(),
    secret: text('secret').notNull(),
    createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (account) => [
    index('account_email_idx').on(account.email),
    uniqueIndex('account_secret_unique_idx').on(account.secret),
]);

export type Account = typeof ACCOUNTS.$inferSelect;
export type NewAccount = typeof ACCOUNTS.$inferInsert;