import { Context } from "hono";
import { Result, ResultAsync, ok, err } from "neverthrow";
import { Errors, OxygenError } from "../core/errors";

type ForwardOptions = {
    target?: string;
    rewritePath?: (path: string) => string;
    addHeaders?: Record<string, string>;
};

type ForwardSuccess = Response;
type ForwardError = OxygenError;

const URL_WHITELIST = [
    /^https?:\/\/([a-zA-Z0-9-]+\.)*ol\.epicgames\.com(\/.*)?$/,
];

export default class Proxy {
    private request: Request;

    constructor(
        private readonly ctx: Context<{ Bindings: CloudflareBindings }>
    ) {
        this.request = ctx.req.raw;
    }

    /**
     * Safely mutates the request body and content-type headers.
     */
    setBody<T extends Record<string, any> | string | Blob>(
        type: "json" | "form" | "text" | "raw" = "json",
        body: T
    ): Result<void, OxygenError> {
        try {
            const headers = new Headers(this.request.headers);
            let payload: BodyInit | null = null;

            switch (type) {
                case "json": {
                    headers.set("Content-Type", "application/json");
                    payload = JSON.stringify(body);
                    break;
                }
                case "form": {
                    headers.set("Content-Type", "application/x-www-form-urlencoded");
                    const params = new URLSearchParams();
                    for (const [key, value] of Object.entries(
                        body as Record<string, unknown>
                    )) {
                        params.set(key, String(value));
                    }
                    payload = params;
                    break;
                }
                case "text": {
                    headers.set("Content-Type", "text/plain");
                    payload = body as string;
                    break;
                }
                case "raw": {
                    payload = body as BodyInit;
                    break;
                }
                default:
                    return err(
                        Errors.BadRequestError(`Unsupported body type: ${type}`)
                    );
            }

            this.request = new Request(this.request.url, {
                method: this.request.method,
                headers,
                body: payload,
            });

            return ok(undefined);
        } catch (e) {
            const msg =
                e instanceof Error ? e.message : "Unknown error in setBody";
            return err(Errors.BadRequestError(`Failed to set body: ${msg}`));
        }
    }

    /**
     * Forwards the request to a remote target, preserving method/body/headers,
     * with recursion prevention and optional path/header rewrites.
     */
    forward(
        opts: ForwardOptions = {}
    ): ResultAsync<ForwardSuccess, ForwardError> {
        return ResultAsync.fromPromise(
            (async () => {
                const target =
                    opts.target ?? this.ctx.req.header("X-Forwarded-Host");

                if (!target) throw Errors.NoTargetError();

                if (this.ctx.req.header("X-Recursion-Test")) {
                    throw Errors.RecursionError();
                }

                const targetWithProtocol = target.startsWith("http")
                    ? target
                    : `https://${target}`;

                if (!URL_WHITELIST.some(pattern => pattern.test(targetWithProtocol))) {
                    throw Errors.NotAllowedError();
                }

                const originalUrl = new URL(this.ctx.req.url);
                const path =
                    opts.rewritePath?.(
                        originalUrl.pathname + originalUrl.search
                    ) ?? (originalUrl.pathname + originalUrl.search);

                const targetUrl = new URL(path, targetWithProtocol);

                const headers = new Headers(this.request.headers);
                headers.set("X-Recursion-Test", "1");

                if (opts.addHeaders) {
                    for (const [k, v] of Object.entries(opts.addHeaders)) {
                        headers.set(k, v);
                    }
                }

                const proxyRequest = new Request(targetUrl, {
                    method: this.request.method,
                    headers,
                    body: this.request.body,
                });

                const response = await fetch(proxyRequest);
                if (!response.ok) {
                    throw Errors.UpstreamError(
                        `Upstream responded with ${response.status}`,
                        {
                            upstreamResponse: {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries()),
                            },
                        }
                    );
                }
                return response;
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
