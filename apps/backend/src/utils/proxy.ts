import { Context } from "hono";
import { Result, ResultAsync, ok, err } from "neverthrow";
import { Errors, OxygenError } from "../core/errors";
import { isProduction } from "./env";

type ForwardOptions = {
    rewritePath?: (path: string) => string;
    addHeaders?: Record<string, string>;
};

const URL_WHITELIST = [
    /^https?:\/\/([a-zA-Z0-9-]+\.)*ol\.epicgames\.com(\/.*)?$/,
    /^https?:\/\/relay\.zetax\.workers\.dev(\/.*)?$/,
    /^https?:\/\/relay\.duck\.codes(\/.*)?$/,
] as const;

const REDIRECT_CODES: ReadonlyArray<number> = [301, 302, 303, 307, 308, 304];

export default class Proxy {
    private request: Request;

    constructor(private readonly ctx: Context<{ Bindings: CloudflareBindings }>) {
        this.request = ctx.req.raw;
    }

    static upstreamUrl(ctx: Context<{ Bindings: CloudflareBindings }>): string {
        const epicHost = ctx.req.header("X-Epic-URL");
        return epicHost ?? "https://relay.duck.codes";
    }

    setBody<T extends Record<string, any> | string | Blob>(
        type: "json" | "form" | "text" | "raw" = "json",
        body: T
    ): Result<void, OxygenError> {
        try {
            const headers = new Headers(this.request.headers);
            let payload: BodyInit | null = null;

            switch (type) {
                case "json":
                    headers.set("Content-Type", "application/json");
                    payload = JSON.stringify(body);
                    break;
                case "form":
                    headers.set("Content-Type", "application/x-www-form-urlencoded");
                    const params = new URLSearchParams();
                    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
                        params.set(key, String(value));
                    }
                    payload = params;
                    break;
                case "text":
                    headers.set("Content-Type", "text/plain");
                    payload = body as string;
                    break;
                case "raw":
                    payload = body as BodyInit;
                    break;
                default:
                    return err(Errors.BadRequestError(`Unsupported body type: ${type}`));
            }

            this.request = new Request(this.request.url, {
                method: this.request.method,
                headers,
                body: payload,
            });

            return ok(undefined);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error in setBody";
            return err(Errors.BadRequestError(`Failed to set body: ${msg}`));
        }
    }

    forward(opts: ForwardOptions = {}): ResultAsync<ProxyResponse, OxygenError> {
        return ResultAsync.fromPromise(
            (async () => {
                const epicHost = this.ctx.req.header("X-Epic-URL"); // might be just a domain
                const relayUrl = "https://relay.duck.codes";

                if (!epicHost) throw Errors.NoTargetError();

                const originalUrl = new URL(this.ctx.req.url);
                const path =
                    opts.rewritePath?.(originalUrl.pathname + originalUrl.search) ??
                    originalUrl.pathname + originalUrl.search;

                // Build a complete, valid URL for the target
                const epicTargetUrl = epicHost.startsWith("http")
                    ? epicHost // full URL already
                    : `https://${epicHost}${path.startsWith("/") ? path : `/${path}`}`;

                // choose base target (relay in dev, direct in prod)
                const baseTarget = isProduction ? epicTargetUrl : relayUrl;

                if (this.ctx.req.header("X-Recursion-Test")) {
                    throw Errors.RecursionError();
                }

                if (!URL_WHITELIST.some((pattern) => pattern.test(baseTarget))) {
                    throw Errors.NotAllowedError();
                }

                const headers = new Headers(this.request.headers);
                headers.set("X-Recursion-Test", "1");

                if (!isProduction) {
                    headers.set("X-Epic-URL", epicTargetUrl);
                }

                if (opts.addHeaders) {
                    for (const [k, v] of Object.entries(opts.addHeaders)) {
                        headers.set(k, v);
                    }
                }

                const proxyRequest = new Request(baseTarget, {
                    method: this.request.method,
                    headers,
                    body:
                        this.request.method !== "GET" && this.request.method !== "HEAD"
                            ? this.request.body
                            : undefined,
                });

                const response = await fetch(proxyRequest);
                if (!response.ok && !REDIRECT_CODES.includes(response.status)) {
                    throw Errors.UpstreamError(
                        `Upstream responded with ${response.status}`,
                        {
                            upstreamResponse: {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries()),
                                upstreamUrl: baseTarget,
                            },
                        }
                    );
                }

                return new ProxyResponse(response.clone());
            })(),
            (e) =>
                e instanceof OxygenError
                    ? e
                    : Errors.ProxyError(
                        `Failed to forward request: ${e instanceof Error ? e.message : String(e)
                        }`
                    )
        );
    }
}

class ProxyResponse extends Response {
    constructor(response: Response) {
        super(response.body, response);
    }

    async isEpicError(): Promise<boolean> {
        return this.headers.get("X-Epic-Error") !== null;
    }
}
