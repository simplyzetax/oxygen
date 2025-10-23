import { app } from "./core/app";
export { DrizzleCacheDurableObject } from './core/dos/DrizzleCacheDurableObject';

import.meta.glob('./services/**/*.ts', { eager: true }) as Record<string, () => Promise<void>>;

export default {
    fetch: app.fetch,
} satisfies ExportedHandler<CloudflareBindings>;
