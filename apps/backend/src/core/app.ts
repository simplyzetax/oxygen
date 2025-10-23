import { Hono } from "hono";
import { eq } from "drizzle-orm";

import { db } from "./databases/d1/client";
import { ACCOUNTS } from "./databases/d1/schemas/account";
import Proxy from "../utils/proxy";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.notFound((c) => {
    return c.json({ error: "Not Found", route: c.req.path }, 404);
});

app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message }, 500);
});

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

app.use('*', async (c, next) => {
    const proxy = new Proxy(c);
    const result = await proxy.forward();
    if (result.isErr()) {
        return result.error.toResponse();
    }
    return result.value;
});

export { app };