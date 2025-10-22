import { app } from "./core/app";
export { DrizzleCacheDurableObject } from './core/dos/DrizzleCacheDurableObject';

import.meta.glob('./services/**/*.ts', { eager: true });

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
