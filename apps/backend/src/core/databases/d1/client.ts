import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { DurableDrizzleCache } from "./cache";
import { Context } from "hono";
import { Account } from "./schemas/accounts";

export const db = (c: Context<{ Bindings: CloudflareBindings, Variables: { account: Account } }>) => {
    const colo = String(c.req.raw.cf?.colo) ?? "global";
    return drizzle(env.D1, {
        cache: new DurableDrizzleCache(colo),
    })
};