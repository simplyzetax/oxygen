import { app } from "../../core/app";
import { Errors } from "../../core/errors";
import Proxy from "../../utils/proxy";
import { FortniteProfile } from "../../utils/mcp/profile";

app.post('/fortnite/api/game/v2/profile/:accountId/client/QueryProfile', async (c) => {

    const proxy = new Proxy(c);
    const response = await proxy.forward();
    if (response.isErr()) {
        return response.error.toResponse();
    }
    const json = await response.value.clone().json<any>();

    const profileId = c.req.query("profileId");
    if (!profileId) {
        return Errors.BadRequestError("profileId is required").toResponse();
    }

    if (!profileId.startsWith("athena")) {
        return response.value;
    }

    const account = c.get("account");

    const profile = new FortniteProfile(c, account.secret, profileId);
    const items = await profile.getItems();
    const attributes = await profile.getAttributes();

    json.profileChanges[0].profile.items = {
        ...json.profileChanges[0].profile.items,
        ...items,
    };

    json.profileChanges[0].profile.stats.attributes = {
        ...json.profileChanges[0].profile.stats.attributes,
        ...attributes,
    };

    return c.json(json);
});