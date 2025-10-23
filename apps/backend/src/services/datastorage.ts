import { and, eq } from "drizzle-orm";
import { app } from "../core/app";
import { db } from "../core/databases/d1/client";
import { HOTFIXES } from "../core/databases/d1/schemas/hotfixes";
import { IniParser } from "../utils/misc/iniParser";
import Proxy from "../utils/proxy";
import { Errors } from "../core/errors";

app.get("/api/v1/access/fortnite/:dssStorageId", async (c) => {
    const proxy = new Proxy(c);
    const epicRes = await proxy.forward();
    if (epicRes.isErr()) return epicRes.error.toResponse();

    const epicJson = await epicRes.value.clone().json<any>();
    const dssStorageId = c.req.param("dssStorageId");

    const decodedDssStorageId = decodeURIComponent(dssStorageId);
    const fileData = epicJson.files[decodedDssStorageId];
    if (!fileData) {
        return Errors.NotFoundError("File not found").toResponse();
    }

    const readLink = fileData.readLink;
    const base64EncodedStorageId = encodeURIComponent(btoa(decodedDssStorageId));
    const base64EncodedReadLink = encodeURIComponent(btoa(readLink));

    const baseUrl = new URL("https://" + Proxy.upstreamUrl(c));

    return c.json({
        files: {
            [decodedDssStorageId]: {
                readLink: `${baseUrl}downloadDssFile/${base64EncodedStorageId}/${base64EncodedReadLink}`,
                writeLink: null,
                hash: fileData.hash,
                lastModified: fileData.lastModified,
                size: fileData.size,
                fileLocked: false
            }
        },
        folderThrottled: false,
        maxFileSizeBytes: epicJson.maxFileSizeBytes || -1,
        maxFolderSizeBytes: epicJson.maxFolderSizeBytes || -1,
        expiresAt: epicJson.expiresAt || new Date().toISOString()
    });
});

app.get("/downloadDssFile/:dssStorageId/:encodedUrl", async (c) => {

    const dssStorageId = decodeURIComponent(c.req.param("dssStorageId"));
    const encodedUrl = decodeURIComponent(c.req.param("encodedUrl"));

    let decodedDssStorageId: string;
    let decodedUrl: string;

    try {
        decodedDssStorageId = atob(dssStorageId);
        decodedUrl = atob(encodedUrl);
    } catch (error) {
        console.error("Failed to decode parameters:", error);
        return Errors.BadRequestError("Invalid encoded parameters").toResponse();
    }

    const res = await fetch(decodedUrl);
    if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to fetch from CloudFront:", res.status, errorText);
        return Errors.UpstreamError("Failed to fetch file").toResponse();
    }

    const originalContent = await res.text();

    const dbHotfixes = await db(c)
        .select()
        .from(HOTFIXES)
        .where(
            and(
                eq(HOTFIXES.dssStorageId, decodedDssStorageId),
            )
        );

    let finalContent = originalContent;
    if (dbHotfixes.length > 0) {
        const filename = dbHotfixes[0].filename;
        finalContent = IniParser.mergeWithDatabaseOverrides(
            originalContent,
            dbHotfixes,
            filename
        );
    }

    c.res.headers.set("Content-Type", "application/octet-stream");
    return c.body(finalContent);
});