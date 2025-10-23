import { Hono } from "hono";
import { db } from "./databases/d1/client";
import { ACCOUNTS } from "./databases/d1/schemas/account";
import { eq } from "drizzle-orm";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use('*', async (c, next) => {
    const key = c.req.header('X-Backend-Key');
    if (!key) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    const account = await db(c).select().from(ACCOUNTS).where(eq(ACCOUNTS.secret, key)).get();
    if (!account) {
        return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
});

export { app };