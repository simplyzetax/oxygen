import { sha1, sha256 } from "hono/utils/crypto";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import Proxy from "../utils/proxy";
import { app } from "../core/app";
import { db } from "../core/databases/d1/client";
import { Hotfix, HOTFIXES } from "../core/databases/d1/schemas/hotfixes";
import { IniParser } from "../utils/misc/iniParser";
import { SystemJSONResponse } from "../types/fortnite/system";

/**
 * Helper function to get Epic's upstream URL from context
 */
function getUpstreamUrl(c: Context): string {
    const epicUrl = c.var.epicUrl;
    return epicUrl.endsWith("/") ? epicUrl.slice(0, -1) : epicUrl;
}

/**
 * Main cloudstorage system endpoint
 * Returns Epic's file list enhanced with custom database hotfixes
 */
app.get("/fortnite/api/cloudstorage/system", async (c) => {
    const proxy = new Proxy(c);

    // Fetch Epic's system file list
    const epicResponse = await proxy.forward();
    if (epicResponse.isErr()) return epicResponse.error.toResponse();

    const result = epicResponse.value;
    const epicSystemFiles = await result.json<SystemJSONResponse[]>();

    // Get all database hotfixes and convert to INI files
    const databaseHotfixes = await db(c).select().from(HOTFIXES);
    const parser = new IniParser(databaseHotfixes);

    const response: SystemJSONResponse[] = [];
    const hotfixUpdatesNeeded: { filename: string; uniqueFilename: string }[] =
        [];

    // Process Epic files and check for hotfix updates needed
    for (const file of epicSystemFiles) {
        response.push(file);

        // Check if we need to update any database hotfixes with new uniqueFilenames
        const matchingHotfix = databaseHotfixes.find(
            (h) => h.filename === file.filename
        );
        if (
            matchingHotfix &&
            matchingHotfix.uniqueFilename !== file.uniqueFilename
        ) {
            hotfixUpdatesNeeded.push({
                filename: file.filename,
                uniqueFilename: file.uniqueFilename,
            });
        }
    }

    // Batch update database hotfixes with new uniqueFilenames (async)
    if (hotfixUpdatesNeeded.length > 0) {
        c.executionCtx.waitUntil(
            (async () => {
                for (const update of hotfixUpdatesNeeded) {
                    console.log(
                        `Updating hotfix ${update.filename} with uniqueFilename ${update.uniqueFilename}`
                    );
                    await db(c)
                        .update(HOTFIXES)
                        .set({ uniqueFilename: update.uniqueFilename })
                        .where(eq(HOTFIXES.filename, update.filename));
                }
            })()
        );
    }

    const customIniFiles = parser.transformToIniFiles(false, false);

    for (const [filename, content] of customIniFiles) {
        response.push({
            uniqueFilename: filename,
            filename: filename,
            hash: (await sha1(content)) ?? "",
            hash256: (await sha256(content)) ?? "",
            length: content.length,
            contentType: "application/octet-stream",
            uploaded: new Date().toISOString(),
            storageType: "DB",
            storageIds: {},
            doNotCache: true,
        });
    }

    return c.json(response);
});

/**
 * Gets a specific hotfix file by uniqueFilename
 * Merges Epic's content with database overrides intelligently
 */
app.get("/fortnite/api/cloudstorage/system/:uniqueFilename", async (c) => {
    const proxy = new Proxy(c);
    const uniqueFilename = c.req.param("uniqueFilename");

    // Fetch Epic's content for this file
    const epicResponse = await proxy.forward();
    if (epicResponse.isErr()) return epicResponse.error.toResponse();

    const result = epicResponse.value;
    const epicContent = await result.text();

    // Get enabled database hotfixes for this file
    const databaseHotfixes = await db(c)
        .select()
        .from(HOTFIXES)
        .where(
            and(
                eq(HOTFIXES.uniqueFilename, uniqueFilename),
                eq(HOTFIXES.enabled, true)
            )
        );

    // Get the normalized filename for this unique filename
    const [normalizedHotfix] = await db
        (c)
        .select({ filename: HOTFIXES.filename })
        .from(HOTFIXES)
        .where(eq(HOTFIXES.uniqueFilename, uniqueFilename));

    const filename = normalizedHotfix?.filename ?? "";

    // If no database overrides, return Epic content as-is
    if (databaseHotfixes.length === 0) {
        c.res.headers.set("Content-Type", "application/octet-stream");
        return c.body(epicContent);
    }

    // Merge Epic content with database overrides
    const mergedContent = IniParser.mergeWithDatabaseOverrides(
        epicContent,
        databaseHotfixes,
        filename
    );

    c.res.headers.set("Content-Type", "application/octet-stream");
    return c.body(mergedContent);
});

/**
 * Development endpoint: Get all hotfixes in database format
 * Returns structured JSON organized by filename
 */
app.get("/fortnite/api/cloudstorage/system/all", async (c) => {
    const upstream = getUpstreamUrl(c);
    const headers = c.req.raw.headers;

    // Fetch Epic's system file list
    const systemResponse = await fetch(
        `${upstream}/fortnite/api/cloudstorage/system`,
        {
            headers,
        }
    );
    const epicFiles = await systemResponse.json<SystemJSONResponse[]>();

    const hotfixesByFilename: Record<string, Hotfix[]> = {};

    // Process each INI file and convert to database format
    for (const file of epicFiles) {
        if (!file.filename.endsWith(".ini")) continue;

        const fileResponse = await fetch(
            `${upstream}/fortnite/api/cloudstorage/system/${file.uniqueFilename}`,
            {
                headers,
            }
        );

        const content = await fileResponse.text();
        const parsedHotfixes = IniParser.parseIniToHotfixes(content, file.filename);

        // Convert to full Hotfix format with auto-generated IDs
        const hotfixes: Hotfix[] = parsedHotfixes.map((hotfix) => ({
            id: `epic_${file.filename}_${hotfix.section}_${hotfix.key}`.replace(
                /[^a-zA-Z0-9_]/g,
                "_"
            ),
            filename: hotfix.filename,
            uniqueFilename: file.uniqueFilename,
            section: hotfix.section,
            key: hotfix.key,
            value: hotfix.value,
            enabled: hotfix.enabled ?? true,
        }));

        hotfixesByFilename[file.filename] = hotfixes;
    }

    return c.json(hotfixesByFilename);
});

/**
 * Development endpoint: Get all hotfixes in raw INI format
 * Returns concatenated INI content with file separators
 */
app.get("/fortnite/api/cloudstorage/system/all/ini", async (c) => {
    const upstream = getUpstreamUrl(c);
    const headers = c.req.raw.headers;

    // Fetch Epic's system file list
    const systemResponse = await fetch(
        `${upstream}/fortnite/api/cloudstorage/system`,
        {
            headers,
        }
    );
    const epicFiles = await systemResponse.json<SystemJSONResponse[]>();

    const iniContents: string[] = [];

    // Fetch each INI file content
    for (const file of epicFiles) {
        if (!file.filename.endsWith(".ini")) continue;

        const fileResponse = await fetch(
            `${upstream}/fortnite/api/cloudstorage/system/${file.uniqueFilename}`,
            {
                headers,
            }
        );

        const content = await fileResponse.text();
        iniContents.push(`; === ${file.filename} ===\n${content}`);
    }

    // Combine all INI contents with separators
    const combinedContent = iniContents.join("\n\n");

    c.res.headers.set("Content-Type", "application/octet-stream");
    return c.body(combinedContent);
});

/**
 * Search endpoint: Find which hotfix files contain a specific string
 * Accepts base64-encoded search strings to handle special characters
 */
app.get("/fortnite/api/cloudstorage/system/search/:searchString", async (c) => {
    const encodedSearchString = c.req.param("searchString");

    // Validate and decode the search string
    if (!encodedSearchString?.trim()) {
        return c.json({ error: "Search string is required" }, 400);
    }

    let searchString: string;
    try {
        searchString = atob(encodedSearchString);
        if (!searchString?.trim()) {
            return c.json({ error: "Decoded search string is empty" }, 400);
        }
    } catch (error) {
        return c.json(
            {
                error: "Invalid base64 encoded search string",
                hint: "Please provide a base64 encoded search string",
            },
            400
        );
    }

    const upstream = getUpstreamUrl(c);
    const headers = c.req.raw.headers;

    // Fetch Epic's system file list
    const systemResponse = await fetch(
        `${upstream}/fortnite/api/cloudstorage/system`,
        {
            headers,
        }
    );
    const epicFiles = await systemResponse.json<SystemJSONResponse[]>();

    const searchResults: {
        filename: string;
        uniqueFilename: string;
        matches: {
            lineNumber: number;
            line: string;
            section: string;
            context: string[];
        }[];
    }[] = [];

    // Search through each INI file
    for (const file of epicFiles) {
        if (!file.filename.endsWith(".ini")) continue;

        const fileResponse = await fetch(
            `${upstream}/fortnite/api/cloudstorage/system/${file.uniqueFilename}`,
            {
                headers,
            }
        );

        const content = await fileResponse.text();
        const lines = content.split(/\r?\n/);
        let currentSection = "";

        const matches: (typeof searchResults)[0]["matches"] = [];

        // Search for the string in each line, tracking sections
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Track current section
            if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
                currentSection = trimmedLine.substring(1, trimmedLine.length - 1);
                return;
            }

            // Check for matches
            if (line.toLowerCase().includes(searchString.toLowerCase())) {
                // Get context lines (2 before and 2 after)
                const contextStart = Math.max(0, index - 2);
                const contextEnd = Math.min(lines.length - 1, index + 2);
                const context = lines.slice(contextStart, contextEnd + 1);

                matches.push({
                    lineNumber: index + 1,
                    line: line.trim(),
                    section: currentSection || "(no section)",
                    context: context,
                });
            }
        });

        // Add to results if matches found
        if (matches.length > 0) {
            searchResults.push({
                filename: file.filename,
                uniqueFilename: file.uniqueFilename,
                matches: matches,
            });
        }
    }

    return c.json({
        encodedSearchString: encodedSearchString,
        searchString: searchString,
        totalFiles: epicFiles.filter((f) => f.filename.endsWith(".ini")).length,
        filesWithMatches: searchResults.length,
        results: searchResults,
    });
});

export const skipIdentifierMiddleware = false;
export const skipOriginMiddleware = false;