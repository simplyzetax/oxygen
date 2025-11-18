import { sha1, sha256 } from "hono/utils/crypto";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";

import Proxy from "../utils/proxy";
import { app } from "../core/app";
import { db } from "../core/databases/d1/client";
import { Hotfix, HOTFIXES } from "../core/databases/d1/schemas/hotfixes";
import { IniParser } from "../utils/misc/iniParser";
import { SystemJSONResponse } from "../types/fortnite/system";

app.get("/fortnite/api/cloudstorage/system/config", async (c) => {
    const proxy = new Proxy(c);
    const epicRes = await proxy.forward();
    return epicRes.isErr() ? epicRes.error.toResponse() : epicRes.value;
});

app.get("/fortnite/api/cloudstorage/system", async (c) => {
    const proxy = new Proxy(c);
    const epicRes = await proxy.forward();
    if (epicRes.isErr()) return epicRes.error.toResponse();

    const epicFiles = await epicRes.value.clone().json<SystemJSONResponse[]>();
    const hotfixRows = await db(c).select().from(HOTFIXES).$withCache(false);
    const parser = new IniParser(hotfixRows);

    const response: SystemJSONResponse[] = [...epicFiles];
    const updatesDssStorageId: { filename: string; dssStorageId: string }[] = [];
    const updatesUniqueFilename: { filename: string; uniqueFilename: string }[] = [];

    for (const epic of epicFiles) {
        const hotfix = hotfixRows.find((h) => h.filename === epic.filename);
        const dssStorageId = epic.storageIds.DSS;
        const uniqueFilename = epic.uniqueFilename;

        if (!hotfix) continue;

        // Compare and queue DSS updates
        if (dssStorageId && hotfix.dssStorageId !== dssStorageId) {
            updatesDssStorageId.push({
                filename: epic.filename,
                dssStorageId,
            });
        }

        console.log(dssStorageId, hotfix.dssStorageId);

        // Compare and queue uniqueFilename updates
        if (uniqueFilename && hotfix.uniqueFilename !== uniqueFilename) {
            updatesUniqueFilename.push({
                filename: epic.filename,
                uniqueFilename,
            });
        }

        epic.doNotCache = true;
    }

    if (updatesDssStorageId.length > 0 || updatesUniqueFilename.length > 0) {
        console.warn(
            `Updating hotfixes — DSS: ${updatesDssStorageId.length}, uniqueFilename: ${updatesUniqueFilename.length}`
        );

        c.executionCtx.waitUntil(
            Promise.allSettled([
                ...updatesDssStorageId.map((u) =>
                    db(c)
                        .update(HOTFIXES)
                        .set({ dssStorageId: u.dssStorageId })
                        .where(eq(HOTFIXES.filename, u.filename))
                ),

                ...updatesUniqueFilename.map((u) =>
                    db(c)
                        .update(HOTFIXES)
                        .set({ uniqueFilename: u.uniqueFilename })
                        .where(eq(HOTFIXES.filename, u.filename))
                ),
            ])
        );
    }

    const iniFiles = parser.transformToIniFiles(false, false);
    const now = new Date().toISOString();

    /* Optional: append generated INI files to response
    for (const [filename, content] of iniFiles) {
        response.push({
            uniqueFilename: filename,
            filename,
            hash: (await sha1(crypto.randomUUID())) ?? "",
            hash256: (await sha256(crypto.randomUUID())) ?? "",
            length: content.length,
            contentType: "application/octet-stream",
            uploaded: now,
            storageType: "DSS",
            storageIds: {
                DSS: "cloudstorage/Live/system/1/" + filename,
            },
            doNotCache: true,
        });
    }*/

    return c.json(response);
});


app.get("/fortnite/api/cloudstorage/system/:uniqueFilename", async (c) => {
    const proxy = new Proxy(c);
    const uniqueFilename = c.req.param("uniqueFilename");

    const epicRes = await proxy.forward();
    if (epicRes.isErr()) return epicRes.error.toResponse();

    const epicContent = await epicRes.value.clone().text();

    const hotfixRows = await db(c)
        .select()
        .from(HOTFIXES)
        .where(
            and(
                eq(HOTFIXES.uniqueFilename, uniqueFilename),
            )
        )
        .$withCache(false);

    if (hotfixRows.length === 0) {
        console.warn("No hotfixes found for", uniqueFilename);
        c.res.headers.set("Content-Type", "application/octet-stream");
        return c.body(epicContent);
    }

    // Since we filtered by uniqueFilename, we can grab the filename from any row
    const hotfixFilename = hotfixRows[0].filename;

    const parser = new IniParser(hotfixRows);
    const content = parser.getIniForFile(hotfixFilename, false, true);
    if (!content) {
        console.warn("No content generated for", hotfixFilename);
        c.res.headers.set("Content-Type", "application/octet-stream");
        return c.body(epicContent);
    }

    c.res.headers.set("Content-Type", "application/octet-stream");
    return c.body(content);
});