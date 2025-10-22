import { index, sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const HOTFIXES = sqliteTable(
    'hotfixes',
    {
        id: text('id').primaryKey().$default(() => crypto.randomUUID()),
        filename: text('file').notNull(),
        section: text('section').notNull(),
        key: text('key').notNull(),
        value: text('value').notNull(),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    },
    (hotfixes) => [
        index('filename_idx').on(hotfixes.filename),
        uniqueIndex('unique_hotfix_idx').on(hotfixes.filename, hotfixes.section, hotfixes.key),
    ],
);

export type Hotfix = typeof HOTFIXES.$inferSelect;
export type NewHotfix = typeof HOTFIXES.$inferInsert;