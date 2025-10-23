import { index, sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const HOTFIXES = sqliteTable(
    "hotfixes",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        filename: text("file").notNull(),
        uniqueFilename: text("unique_filename"),
        section: text("section").notNull(),
        key: text("key").notNull(),
        value: text("value").notNull(),
        enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    },
    (hotfixes) => {
        return {
            nameIndex: index("filename_idx").on(hotfixes.filename),
            sectionIndex: index("section_idx").on(hotfixes.section),
            keyIndex: index("key_idx").on(hotfixes.key),
        };
    }
);
export type Hotfix = typeof HOTFIXES.$inferSelect;
export type NewHotfix = typeof HOTFIXES.$inferInsert;