export default {
    async fetch(request: Request): Promise<Response> {
        const targetUrl = request.headers.get("X-Epic-URL");
        if (!targetUrl) {
            return new Response("Missing X-Epic-URL header", { status: 400 });
        }

        const reqUrl = new URL(request.url);
        const tgtUrl = new URL(targetUrl);

        // 🚫 Prevent recursion (relay calling itself)
        if (reqUrl.origin === tgtUrl.origin) {
            return new Response("Recursion detected", { status: 403 });
        }

        try {
            // Clone headers and remove control headers
            const headers = new Headers(request.headers);
            headers.delete("Host");
            headers.delete("X-Epic-URL");

            // Build initial upstream request
            let upstreamReq = new Request(targetUrl, {
                method: request.method,
                headers,
                body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
                redirect: "manual", // important: don’t auto-follow redirects
            });

            let response = await fetch(upstreamReq);
            let redirectCount = 0;

            // 🌀 Handle up to 10 redirects manually
            while ([301, 302, 303, 307, 308].includes(response.status) && redirectCount < 10) {
                const location = response.headers.get("location");
                if (!location) break;

                // Resolve relative redirects correctly
                const resolved = new URL(location, targetUrl).toString();
                console.log(`[Relay] Redirect ${redirectCount + 1} → ${resolved}`);

                upstreamReq = new Request(resolved, {
                    method:
                        response.status === 303
                            ? "GET" // 303 should always switch to GET
                            : upstreamReq.method,
                    headers,
                    body:
                        upstreamReq.method !== "GET" && upstreamReq.method !== "HEAD"
                            ? upstreamReq.body
                            : undefined,
                    redirect: "manual",
                });

                response = await fetch(upstreamReq);
                redirectCount++;
            }

            if (redirectCount >= 10) {
                return new Response("Too many redirects", { status: 502 });
            }

            // Clone response headers fully
            const resHeaders = new Headers(response.headers);
            resHeaders.set("X-Relay-Redirects", redirectCount.toString());

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: resHeaders,
            });
        } catch (err) {
            console.error("[Relay] Proxy error:", err);
            return new Response(
                `Proxy error: ${err instanceof Error ? err.message : String(err)}`,
                { status: 502 },
            );
        }
    },
} satisfies ExportedHandler<Cloudflare.Env>;
