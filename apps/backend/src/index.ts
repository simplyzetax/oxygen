import { app } from "./core/app";

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
