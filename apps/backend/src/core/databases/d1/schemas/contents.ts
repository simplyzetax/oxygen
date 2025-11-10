import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';


export const CONTENT = sqliteTable(
    'content',
    {
        id: text('id').primaryKey().$default(() => crypto.randomUUID()),
        key: text('key').notNull(),
        valueJSON: text('value_json', { mode: 'json' }).notNull().default(JSON.stringify({})),
    },
    (content) => [
        index('content_id_idx').on(content.id),
        uniqueIndex('content_key_unique_idx').on(content.key),
    ],
);

export type Content = typeof CONTENT.$inferSelect;
export type NewContent = typeof CONTENT.$inferInsert;