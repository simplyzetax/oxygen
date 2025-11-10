import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { ACCOUNTS } from "./accounts";

export const ATTRIBUTES = sqliteTable(
    "attributes",
    {
        accountSecret: text("account_secret")
            .notNull()
            .references(() => ACCOUNTS.secret),
        profileId: text("profile_id").notNull(),
        key: text("key").notNull(),
        valueJSON: text("value_json", { mode: "json" }).notNull(),
    },
    (attributes) => {
        return {
            idIndex: index("attr_id_idx").on(attributes.profileId),
            // Add unique constraint on profileId and key combination
            profileKeyUnique: uniqueIndex("attr_profile_key_unique_idx").on(
                attributes.profileId,
                attributes.key
            ),
        };
    }
);

export type Attribute = typeof ATTRIBUTES.$inferSelect;
export type NewAttribute = typeof ATTRIBUTES.$inferInsert;