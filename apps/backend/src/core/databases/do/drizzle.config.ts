import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "sqlite",
    driver: "durable-sqlite",
    schema: ["./src/core/databases/do/schemas/**/*.ts"],
    out: "./src/core/databases/do/migrations",
});