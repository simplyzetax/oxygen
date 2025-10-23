import { app } from "./core/app";
import Proxy from "./utils/proxy";
export { DrizzleCacheDurableObject } from "./core/dos/DrizzleCacheDurableObject";

//import.meta.glob("./services/**/*.ts", { eager: true });
import "./services/datastorage";
import "./services/cloudstorage";
import "./services/health";

app.use("*", async (c) => {
    const proxy = new Proxy(c);
    const result = await proxy.forward();
    return result.isErr() ? result.error.toResponse() : result.value;
});

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
