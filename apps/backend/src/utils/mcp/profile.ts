import { db } from "../../core/databases/d1/client";
import { Attribute, ATTRIBUTES } from "../../core/databases/d1/schemas/attributes";
import { Item, ITEMS, NewItem } from "../../core/databases/d1/schemas/items";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import { Account } from "../../core/databases/d1/schemas/accounts";

export class FortniteProfile {
    public identifier: string;
    public profileId: string;

    constructor(private readonly ctx: Context<{ Bindings: CloudflareBindings, Variables: { account: Account } }>, identifier: string, profileId: string) {
        this.identifier = identifier;
        this.profileId = profileId;
    }

    public async getItems() {
        const items = await db(this.ctx)
            .select()
            .from(ITEMS)
            .where(
                and(
                    eq(ITEMS.accountSecret, this.ctx.get("account").secret),
                    eq(ITEMS.profileId, this.profileId)
                )
            ).$withCache(false);

        return this.processItems(items);
    }

    /**
     * Processes the items to be returned in the response, making it compatible with the MCP response
     * @param items - The items to process
     * @returns The processed items
     */
    async processItems(items: Item[]) {
        const itemsMap: Record<string, any> = {};

        for (const dbItem of items) {
            itemsMap[dbItem.id] = {
                templateId: dbItem.templateId,
                ...dbItem.jsonAttributes,
            };
        }

        return itemsMap;
    }

    public async addItem(item: Omit<NewItem, "accountIdentifier" | "profileId">) {
        await db(this.ctx)
            .insert(ITEMS)
            .values({
                ...item,
                accountSecret: this.ctx.get("account").secret,
                profileId: this.profileId,
            })
            .onConflictDoUpdate({
                target: [ITEMS.accountSecret, ITEMS.profileId, ITEMS.templateId],
                set: {
                    quantity: item.quantity,
                },
            });
    }

    public async getAttributes() {
        const attributes = await db(this.ctx)
            .select()
            .from(ATTRIBUTES)
            .where(
                and(
                    eq(ATTRIBUTES.accountSecret, this.ctx.get("account").secret),
                    eq(ATTRIBUTES.profileId, this.profileId)
                )
            );

        return this.processAttributes(attributes);
    }

    async processAttributes(attributes: Attribute[]) {
        const attributesMap: Record<string, any> = {};

        for (const dbAttribute of attributes) {
            attributesMap[dbAttribute.key] = {
                value: dbAttribute.valueJSON,
            };
        }

        return attributesMap;
    }

    public async getAttribute(key: string) {
        const attribute = await db(this.ctx)
            .select()
            .from(ATTRIBUTES)
            .where(
                and(eq(ATTRIBUTES.accountSecret, this.ctx.get("account").secret), eq(ATTRIBUTES.key, key))
            );
        return attribute;
    }

    public async updateAttribute(key: string, value: any) {
        await db(this.ctx)
            .insert(ATTRIBUTES)
            .values({
                accountSecret: this.ctx.get("account").secret,
                profileId: this.profileId,
                key,
                valueJSON: value,
            })
            .onConflictDoUpdate({
                target: [ATTRIBUTES.accountSecret, ATTRIBUTES.profileId, ATTRIBUTES.key],
                set: {
                    valueJSON: value,
                },
            });
    }
}