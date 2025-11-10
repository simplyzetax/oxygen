import { app } from "./core/app";
import Proxy from "./utils/proxy";
export { DrizzleCacheDurableObject } from "./core/dos/DrizzleCacheDurableObject";

import.meta.glob("./services/**/*.{ts,tsx}", { eager: true });

app.all("*", async (c) => {
    const proxy = new Proxy(c);
    const result = await proxy.forward();
    return result.isErr() ? result.error.toResponse() : result.value;
});

const handler: ExportedHandler<CloudflareBindings> = {
    fetch: (request, env, ctx) => app.fetch(request, env, ctx),
};

export default handler;
