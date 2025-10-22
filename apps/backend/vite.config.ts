import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
    plugins: [cloudflare(), {
        name: "vite-raw-sql-loader",
        enforce: "pre",
        transform(code, id) {
            if (id.endsWith(".sql")) {
                return `export default ${JSON.stringify(code)};`;
            }
        },
    },],
    server: {
        allowedHosts: true,
        port: 8787,
    },
});