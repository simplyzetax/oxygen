import { Hono } from "hono";
import { eq } from "drizzle-orm";

import { db } from "./databases/d1/client";
import { Account, ACCOUNTS } from "./databases/d1/schemas/accounts";

const app = new Hono<{ Bindings: CloudflareBindings, Variables: { account: Account } }>()
    .use(async (c, next) => {
        const key = c.req.header('X-Backend-Key');
        if (!key) {
            return c.json({ error: "Unauthoried" }, 401);
        }
        const account = await db(c).select().from(ACCOUNTS).where(eq(ACCOUNTS.secret, key)).get();
        if (!account) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        c.set("account", account);
        await next();
    })
    .use(async (c, next) => {
        const colo = String(c.req.raw.cf?.colo) ?? "global"
        const durableObjectId = c.env.DrizzleCacheDurableObject.idFromName(colo);
        const durableObject = c.env.DrizzleCacheDurableObject.get(durableObjectId);

        const override = await durableObject.getOverride(c.req.path, c.req.method);
        if (override) {
            c.res.headers.set("Content-Type", override.contentType);
            c.res.headers.set("Cache-Control", "no-cache");
            return c.body(override.response);
        } else {
            await next();
        }
    })

app.notFound((c) => {
    return c.json({ error: "Not Found", route: c.req.path }, 404);
});

app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 500);
});

export { app };