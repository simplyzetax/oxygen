import { app } from "../core/app";

app.on(["POST", "PUT", "DELETE"], "/overrides", async (c) => {
    const colo = String(c.req.raw.cf?.colo) ?? "global"
    const durableObjectId = c.env.DrizzleCacheDurableObject.idFromName(colo);
    const durableObject = c.env.DrizzleCacheDurableObject.get(durableObjectId);

    let operation: "added" | "updated" | "deleted";

    switch (c.req.method) {
        case "POST":
            await durableObject.addOverride(c.req.path, c.req.method, await c.req.arrayBuffer());
            operation = "added";
            break;
        // Redundant but I like to have both for clarity and to comply with web standards
        case "PUT":
            await durableObject.addOverride(c.req.path, c.req.method, await c.req.arrayBuffer());
            operation = "updated";
            break;
        case "DELETE":
            await durableObject.deleteOverride(c.req.path, c.req.method);
            operation = "deleted";
            break;
        default:
            return c.json({ error: "Method not allowed" }, 405);
    }

    return c.json({ message: `Override ${operation} successfully` });
});
