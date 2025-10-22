import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/durable-sqlite";
import { eq } from "drizzle-orm";

import { cacheTable, DrizzleCache } from "../databases/do/schemas/cache";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";

//@ts-expect-error - no types for migrations
import migrations from '../databases/do/migrations/migrations.js';

export class DrizzleCacheDurableObject extends DurableObject {
    private db = drizzle(this.ctx.storage);
    private memoryCache = new Map<string, Omit<DrizzleCache, 'key'>>();

    constructor(state: DurableObjectState, env: CloudflareBindings) {
        super(state, env);
        this.ctx.blockConcurrencyWhile(async () => {
            console.log("Migrating database");
            await migrate(this.db, migrations);
        });
    }

    async get(key: string): Promise<any> {
        const now = Date.now();
        const mem = this.memoryCache.get(key);
        if (mem && mem.expiresAt > now) return mem.value;

        const row = this.db.select().from(cacheTable).where(eq(cacheTable.key, key)).get();
        if (!row || row.expiresAt < now) {
            this.memoryCache.delete(key);
            if (row) this.db.delete(cacheTable).where(eq(cacheTable.key, key)).run();
            return undefined;
        }

        const parsed = JSON.parse(row.value);
        this.memoryCache.set(key, { value: parsed, expiresAt: row.expiresAt });
        return parsed;
    }

    async put(key: string, value: any, ttlMs: number) {
        const expiresAt = Date.now() + ttlMs;
        const jsonValue = JSON.stringify(value);

        this.db
            .insert(cacheTable)
            .values({ key, value: jsonValue, expiresAt })
            .onConflictDoUpdate({
                target: cacheTable.key,
                set: { value: jsonValue, expiresAt },
            })
            .run();

        this.memoryCache.set(key, { value, expiresAt });
    }

    async delete(key: string) {
        this.db.delete(cacheTable).where(eq(cacheTable.key, key)).run();
        this.memoryCache.delete(key);
    }

    /**
     * Maintain a simple index of table -> [cache keys].
     * We store the index as a special row in cacheTable with a very long expiry.
     */
    async addToIndex(indexKey: string, cacheKey: string) {
        // Read existing index
        const now = Date.now();
        const row = this.db.select().from(cacheTable).where(eq(cacheTable.key, indexKey)).get();
        let list: string[] = [];
        if (row && row.expiresAt > now) {
            try { list = JSON.parse(row.value) as string[]; } catch { list = []; }
        }
        if (!list.includes(cacheKey)) list.push(cacheKey);

        const jsonValue = JSON.stringify(list);
        const farFuture = now + 365 * 24 * 60 * 60 * 1000; // ~1 year
        this.db
            .insert(cacheTable)
            .values({ key: indexKey, value: jsonValue, expiresAt: farFuture })
            .onConflictDoUpdate({
                target: cacheTable.key,
                set: { value: jsonValue, expiresAt: farFuture },
            })
            .run();
    }

    async getIndex(indexKey: string): Promise<string[]> {
        const now = Date.now();
        const row = this.db.select().from(cacheTable).where(eq(cacheTable.key, indexKey)).get();
        if (!row || row.expiresAt < now) {
            if (row) this.db.delete(cacheTable).where(eq(cacheTable.key, indexKey)).run();
            return [];
        }
        try {
            return JSON.parse(row.value) as string[];
        } catch {
            return [];
        }
    }

    async clearIndex(indexKey: string) {
        this.db.delete(cacheTable).where(eq(cacheTable.key, indexKey)).run();
    }

    async clear() {
        this.memoryCache.clear();
        this.db.delete(cacheTable).run();
    }
}
