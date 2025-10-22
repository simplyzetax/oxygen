import { Cache } from "drizzle-orm/cache/core";
import { CacheConfig } from "drizzle-orm/cache/core/types";
import { DrizzleCacheDurableObject } from "../../dos/DrizzleCacheDurableObject";
import { env } from "cloudflare:workers";

const DEFAULT_TTL_SECONDS = 300;
const DISABLE_CACHE = false;

interface MutationParams {
    tables?: string[];
    tags?: string | string[];
}

export class DurableDrizzleCache extends Cache {
    private readonly durableObject: DurableObjectStub<DrizzleCacheDurableObject>;

    constructor(
        private readonly location: string,
        private readonly globalTtl: number = DEFAULT_TTL_SECONDS
    ) {
        super();

        const durableObjectId = env.DrizzleCacheDurableObject.idFromName(location);
        this.durableObject = env.DrizzleCacheDurableObject.get(durableObjectId);
    }

    strategy(): "explicit" | "all" {
        return "all";
    }

    /** Get cache entry */
    override async get(key: string): Promise<any[] | undefined> {
        if (DISABLE_CACHE) {
            console.log(`[CACHE] GET ${key} - CACHE DISABLED`);
            return undefined;
        }
        const prefixedKey = this.buildCacheKey(key);

        try {
            //@ts-ignore - FUCKING TYPERSCRUPT POSSIBLY INFINITE TYPE RECURSION
            const result = await this.durableObject.get(prefixedKey);
            if (result !== undefined) {
                console.log(`[CACHE] GET ${key} - HIT`);
            } else {
                console.log(`[CACHE] GET ${key} - MISS`);
            }
            return result;
        } catch (err) {
            console.error(`[CACHE] GET ${key} - ERROR:`, err);
            return undefined;
        }
    }

    /** Put cache entry */
    override async put(
        key: string,
        value: any,
        tables: string[],
        isTag: boolean,
        config?: CacheConfig
    ): Promise<void> {
        if (DISABLE_CACHE) {
            console.log(`[CACHE] PUT ${key} - CACHE DISABLED`);
            return;
        }
        const prefixedKey = this.buildCacheKey(key);
        const ttlMs = (config?.ex ?? this.globalTtl) * 1000;

        try {
            await this.durableObject.put(prefixedKey, value, ttlMs);
            console.log(`[CACHE] PUT ${key} - SUCCESS (TTL: ${ttlMs}ms)`);

            // If Drizzle provided table tags, the query opted into auto-invalidation.
            // Record the association so onMutate can precisely invalidate.
            if (tables && tables.length > 0) {
                for (const table of tables) {
                    const indexKey = this.buildIndexKey(table);
                    try {
                        // @ts-ignore - calling DO method dynamically
                        await this.durableObject.addToIndex(indexKey, prefixedKey);
                    } catch (err) {
                        console.error(`[CACHE] INDEX ADD ${indexKey} -> ${prefixedKey} - ERROR:`, err);
                    }
                }
            }
        } catch (err) {
            console.error(`[CACHE] PUT ${key} - ERROR:`, err);
        }
    }

    /** Delete a specific cache entry */
    async delete(key: string): Promise<void> {
        const prefixedKey = this.buildCacheKey(key);
        try {
            await this.durableObject.delete(prefixedKey);
            console.log(`[CACHE] DELETE ${key} - SUCCESS`);
        } catch (err) {
            console.error(`[CACHE] DELETE ${key} - ERROR:`, err);
        }
    }

    /** Clear entire cache */
    async clear(): Promise<void> {
        try {
            await this.durableObject.clear();
            console.log(`[CACHE] CLEAR - SUCCESS`);
        } catch (err) {
            console.error(`[CACHE] CLEAR - ERROR:`, err);
        }
    }

    /** Optional mutation hook for table invalidation */
    override async onMutate(params: MutationParams): Promise<void> {
        const tables = params.tables ?? [];
        if (tables.length === 0) {
            console.log(`[CACHE] MUTATE - NO TABLES TO INVALIDATE`);
            return;
        }

        console.log(`[CACHE] MUTATE - INVALIDATING TABLES: ${tables.join(', ')}`);

        for (const table of tables) {
            const indexKey = this.buildIndexKey(table);
            try {
                // @ts-ignore - calling DO method dynamically
                const keys: string[] = (await this.durableObject.getIndex(indexKey)) ?? [];
                if (keys.length === 0) continue;

                for (const k of keys) {
                    try {
                        await this.durableObject.delete(k);
                        console.log(`[CACHE] INVALIDATE key ${k} due to table ${table}`);
                    } catch (err) {
                        console.error(`[CACHE] INVALIDATE key ${k} - ERROR:`, err);
                    }
                }

                // Clear the index after invalidation
                // @ts-ignore - calling DO method dynamically
                await this.durableObject.clearIndex(indexKey);
            } catch (err) {
                console.error(`[CACHE] MUTATE - ERROR for table ${table}:`, err);
            }
        }
    }

    /** Internal helper to prefix keys */
    private buildCacheKey(key: string): string {
        return `${this.location}-${key}`;
    }

    /** Build an index key for a table within this cache location */
    private buildIndexKey(table: string): string {
        return `${this.location}-index:${table}`;
    }
}
