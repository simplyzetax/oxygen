import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { ACCOUNTS } from "./accounts";

const defaultJsonAttributes = {
    item_seen: true,
    variants: [],
};

export const ITEMS = sqliteTable(
    "items",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        templateId: text("template_id").notNull(),
        accountSecret: text("account_secret")
            .notNull()
            .references(() => ACCOUNTS.secret),
        profileId: text("profile_id").notNull(),
        jsonAttributes: text("attributes", { mode: "json" })
            .notNull()
            .default(defaultJsonAttributes)
            .$type<Record<string, any>>(),
        quantity: integer("quantity").notNull().default(1),
        favorite: integer("favorite", { mode: "boolean" }).default(false),
        seen: integer("has_seen", { mode: "boolean" }).default(false),
    },
    (items) => {
        return {
            profileIdIndex: index("items_profile_id_idx").on(items.profileId),
            templateIdIndex: index("items_template_id_idx").on(items.templateId),
        };
    }
);

export type Item = typeof ITEMS.$inferSelect;
export type NewItem = typeof ITEMS.$inferInsert;