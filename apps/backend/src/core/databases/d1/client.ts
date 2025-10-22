import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { DurableDrizzleCache } from "../cache";

export const db = (request: Request) => {
    const colo = String(request.cf?.colo) ?? "global";
    //const random = Math.floor(Math.random() * 3) + 1;
    return drizzle(env.D1, {
        cache: new DurableDrizzleCache(env, "drizzle-cache", colo),
    })
};