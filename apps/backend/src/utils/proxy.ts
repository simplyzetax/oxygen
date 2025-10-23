import { Context } from "hono";
import { Errors } from "../core/errors";

type ForwardOptions = {
    target?: string;
    rewritePath?: (path: string) => string;
    addHeaders?: Record<string, string>;
};

export default class Proxy {
    private request: Request;

    constructor(private readonly ctx: Context<{ Bindings: CloudflareBindings }>) {
        this.request = ctx.req.raw;
    }

    setBody<T extends Record<string, any> | string | Blob>(
        type: "json" | "form" | "text" | "raw" = "json",
        body: T
    ) {
        const headers = new Headers(this.request.headers);
        let payload: BodyInit | null = null;

        switch (type) {
            case "json":
                headers.set("Content-Type", "application/json");
                payload = JSON.stringify(body);
                break;
            case "form":
                headers.set("Content-Type", "application/x-www-form-urlencoded");
                payload = new URLSearchParams(
                    Object.entries(body as Record<string, any>).map(([k, v]) => [
                        k,
                        String(v),
                    ])
                );
                break;
            case "text":
                headers.set("Content-Type", "text/plain");
                payload = body as string;
                break;
            case "raw":
                payload = body as BodyInit;
                break;
            default:
                throw new Error(`Unsupported body type`);
        }

        this.request = new Request(this.request.url, {
            method: this.request.method,
            headers,
            body: payload,
        });
    }

    async forward(opts: ForwardOptions = {}) {
        const target =
            opts.target ??
            this.ctx.req.header("X-Forwarded-Host");
        if (!target) {
            return Errors.NoTargetError.toResponse();
        }

        const recursionTest = this.ctx.req.header("X-Recursion-Test");
        if (recursionTest) {
            return Errors.RecursionError.toResponse();
        }

        const targetWithProtocol = target.startsWith('http') ? target : `https://${target}`;

        const originalUrl = new URL(this.ctx.req.url);
        const path = opts.rewritePath
            ? opts.rewritePath(originalUrl.pathname + originalUrl.search)
            : originalUrl.pathname + originalUrl.search;

        console.log(path, targetWithProtocol);

        const targetUrl = new URL(path, targetWithProtocol);

        const headers = new Headers(this.request.headers);
        headers.set("X-Recursion-Test", "1");

        if (opts.addHeaders) {
            for (const [key, value] of Object.entries(opts.addHeaders)) {
                headers.set(key, value);
            }
        }

        const proxyRequest = new Request(targetUrl.toString(), {
            method: this.request.method,
            headers,
            body: this.request.body,
        });

        return await fetch(proxyRequest);
    }
}
