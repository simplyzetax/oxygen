class OxygenError extends Error {
    code: number;
    name: string;

    constructor(message: string) {
        super(message);
        this.name = "ProxyError";
        this.code = 500;
    }

    async toResponse() {
        return new Response(JSON.stringify({
            error: this.message,
            code: this.code,
            name: this.name,
        }), { status: this.code });
    }

    throw() {
        throw this;
    }
}

export const Errors = {
    ProxyError: new OxygenError("Proxy error"),
    RecursionError: new OxygenError("Recursion detected"),
    NoTargetError: new OxygenError("No target host provided"),
    UnauthorizedError: new OxygenError("Unauthorized"),
    NotFoundError: new OxygenError("Not Found"),
    BadRequestError: new OxygenError("Bad Request"),
    InternalServerError: new OxygenError("Internal Server Error"),
    ServiceUnavailableError: new OxygenError("Service Unavailable"),
    GatewayTimeoutError: new OxygenError("Gateway Timeout"),
}

