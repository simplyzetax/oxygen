import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { DurableDrizzleCache } from "./cache";
import { Context } from "hono";

export const db = (c: Context<{ Bindings: CloudflareBindings }>) => {
    const colo = String(c.req.raw.cf?.colo) ?? "global";
    return drizzle(env.D1, {
        cache: new DurableDrizzleCache(colo),
    })
};