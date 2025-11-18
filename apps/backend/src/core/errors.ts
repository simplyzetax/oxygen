export class OxygenError extends Error {
    public readonly code: number;
    public readonly name: string;
    public readonly body: Record<string, any>;

    constructor(name: string, message: string, code = 500, body: Record<string, any> = {}) {
        super(message);
        this.name = name;
        this.code = code;
        this.body = body;
    }

    toJSON() {
        return { error: this.message, code: this.code, name: this.name, ...this.body };
    }

    toResponse(): Response {
        return new Response(JSON.stringify(this.toJSON()), {
            status: this.code,
            headers: { "Content-Type": "application/json", "Proxy": "Oxygen" },
        });
    }

    throw(): never {
        throw this;
    }
}

export const Errors = {
    NotAllowedError: (msg = "Not allowed") =>
        new OxygenError("NotAllowedError", msg, 403),
    ProxyError: (msg = "Proxy error") =>
        new OxygenError("ProxyError", msg, 502),
    RecursionError: (msg = "Recursion detected") =>
        new OxygenError("RecursionError", msg, 508),
    NoTargetError: (msg = "No target host provided") =>
        new OxygenError("NoTargetError", msg, 400),
    UnauthorizedError: (msg = "Unauthorized") =>
        new OxygenError("UnauthorizedError", msg, 401),
    NotFoundError: (msg = "Not Found") =>
        new OxygenError("NotFoundError", msg, 404),
    BadRequestError: (msg = "Bad Request") =>
        new OxygenError("BadRequestError", msg, 400),
    InternalServerError: (msg = "Internal Server Error") =>
        new OxygenError("InternalServerError", msg, 500),
    ServiceUnavailableError: (msg = "Service Unavailable") =>
        new OxygenError("ServiceUnavailableError", msg, 503),
    GatewayTimeoutError: (msg = "Gateway Timeout") =>
        new OxygenError("GatewayTimeoutError", msg, 504),
    UpstreamError: (msg = "Upstream error", body: Record<string, any> = {}) =>
        new OxygenError("UpstreamError", msg, 502, body),
};
