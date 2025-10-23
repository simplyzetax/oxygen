import { app } from "../core/app";
import Proxy from "../utils/proxy";

app.get("/content/api/pages/fortnite-game/", async (c) => {
    const proxy = new Proxy(c);

    const response = await proxy.forward();
    if (response.isErr()) {
        return response.error.toResponse();
    }

    const json = await response.value.clone().json<any>();

    json.emergencynoticev2 = {
        _title: "emergencynoticev2",
        _locale: "en-US",
        _noIndex: false,
        _activeDate: "2018-08-06T19:00:26.217Z",
        lastModified: "2021-12-01T15:55:56.012Z",
        "jcr:baseVersion": "a7ca237317f1e771e921e2-7f15-4485-b2e2-553b809fa363",
        emergencynotices: {
            _type: "Emergency Notices",
            emergencynotices: [
                {
                    body: `Version ${c.env.CF_VERSION_METADATA.id}-${c.env.CF_VERSION_METADATA.tag}`,
                    _type: "CommonUI Emergency Notice Base",
                    title: "Hybrid",
                    hidden: false,
                    gamemodes: [],
                },
            ],
        },
        "jcr:isCheckedOut": true,
    };

    json.emergencynotice = {
        news: {
            _type: "Battle Royale News",
            messages: [
                {
                    body: `Version ${c.env.CF_VERSION_METADATA.tag}`,
                    _type: "CommonUI Simple Message Base",
                    title: "Hybrid",
                    hidden: false,
                    spotlight: true,
                },
            ],
        },
        _title: "emergencynotice",
        _locale: "en-US",
        _noIndex: false,
        alwaysShow: false,
        _activeDate: "2018-08-06T19:00:26.217Z",
        lastModified: "2019-10-29T22:32:52.686Z",
    };

    return c.json(json);
});