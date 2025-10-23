import { env } from "cloudflare:workers";

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";