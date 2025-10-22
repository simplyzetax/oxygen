import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { DurableDrizzleCache } from "./cache";

export const db = (request: Request) => {
    const colo = String(request.cf?.colo) ?? "global";
    return drizzle(env.D1, {
        cache: new DurableDrizzleCache(colo),
    })
};