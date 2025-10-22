import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    schema: ["./src/core/databases/d1/schemas/**/*.ts"],
    out: "./src/core/databases/d1/migrations",
});