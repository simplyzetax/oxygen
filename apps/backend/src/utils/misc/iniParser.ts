import { Hotfix, NewHotfix } from "../../core/databases/d1/schemas/hotfixes";

export class IniParser {
    private hotfixes: Hotfix[];

    constructor(hotfixes: Hotfix[]) {
        this.hotfixes = hotfixes;
    }

    /**
     * Transforms all hotfixes into a map of filename -> .ini content
     * @param includeDisabled Whether to include disabled hotfixes (default: false)
     * @param scope Filter by scope (default: 'user')
     * @param includeTimestamp Whether to include timestamp in generated files (default: true)
     * @returns Map of filename to .ini file content
     */
    public transformToIniFiles(
        includeDisabled: boolean = false,
        includeTimestamp: boolean = true
    ): Map<string, string> {
        const fileMap = new Map<string, string>();

        // Filter hotfixes based on criteria
        const filteredHotfixes = this.hotfixes.filter((hotfix) => {
            if (!includeDisabled && !hotfix.enabled) return false;
            return true;
        });

        // Group hotfixes by filename
        const groupedByFile = this.groupByFilename(filteredHotfixes);

        // Transform each file group into .ini format
        for (const [filename, hotfixes] of groupedByFile) {
            const iniContent = this.transformFileToIni(hotfixes, includeTimestamp);
            fileMap.set(filename, iniContent);
        }

        return fileMap;
    }

    /**
     * Transforms hotfixes for a single file into .ini format
     * @param hotfixes Array of hotfixes for a single file
     * @param includeTimestamp Whether to include timestamp in generated file (default: true)
     * @returns .ini formatted string
     */
    private transformFileToIni(
        hotfixes: Hotfix[],
        includeTimestamp: boolean = true
    ): string {
        const sections = this.groupBySection(hotfixes);
        const iniLines: string[] = [];

        // Add header comment
        iniLines.push("; Generated ini file");
        if (includeTimestamp) {
            iniLines.push("; Auto-generated on " + new Date().toISOString());
        }
        iniLines.push("");

        // Process each section
        for (const [sectionName, sectionHotfixes] of sections) {
            // Add section header
            iniLines.push(`[${sectionName}]`);

            // Add key-value pairs
            for (const hotfix of sectionHotfixes) {
                const line = this.formatKeyValuePair(hotfix);
                iniLines.push(line);
            }

            // Add empty line after section (except for last section)
            iniLines.push("");
        }

        // Remove trailing empty line
        if (iniLines[iniLines.length - 1] === "") {
            iniLines.pop();
        }

        return iniLines.join("\n");
    }

    /**
     * Formats a hotfix into a key=value pair with optional comment
     * @param hotfix The hotfix to format
     * @returns Formatted .ini line
     */
    private formatKeyValuePair(hotfix: Hotfix): string {
        let line = `${hotfix.key}=${hotfix.value}`;

        // Add comment with metadata if needed
        const metadata: string[] = [];
        if (!hotfix.enabled) metadata.push("disabled");

        if (metadata.length > 0) {
            line += ` ; ${metadata.join(", ")}`;
        }

        return line;
    }

    /**
     * Groups hotfixes by filename
     * @param hotfixes Array of hotfixes to group
     * @returns Map of filename to hotfixes array
     */
    private groupByFilename(hotfixes: Hotfix[]): Map<string, Hotfix[]> {
        const grouped = new Map<string, Hotfix[]>();

        for (const hotfix of hotfixes) {
            if (!grouped.has(hotfix.filename)) {
                grouped.set(hotfix.filename, []);
            }
            grouped.get(hotfix.filename)!.push(hotfix);
        }

        return grouped;
    }

    /**
     * Groups hotfixes by section within a file
     * @param hotfixes Array of hotfixes to group by section
     * @returns Map of section name to hotfixes array
     */
    private groupBySection(hotfixes: Hotfix[]): Map<string, Hotfix[]> {
        const grouped = new Map<string, Hotfix[]>();

        for (const hotfix of hotfixes) {
            if (!grouped.has(hotfix.section)) {
                grouped.set(hotfix.section, []);
            }
            grouped.get(hotfix.section)!.push(hotfix);
        }

        // Sort sections alphabetically for consistent output
        return new Map([...grouped.entries()].sort());
    }

    /**
     * Gets a single .ini file content for a specific filename
     * @param filename The filename to get .ini content for
     * @param includeDisabled Whether to include disabled hotfixes
     * @param scope Filter by scope
     * @param includeTimestamp Whether to include timestamp in generated file (default: true)
     * @returns .ini file content or undefined if file not found
     */
    public getIniForFile(
        filename: string,
        includeDisabled: boolean = false,
        includeTimestamp: boolean = true
    ): string | undefined {
        const fileMap = this.transformToIniFiles(includeDisabled, includeTimestamp);
        return fileMap.get(filename);
    }

    /**
     * Gets all unique filenames from the hotfixes
     * @returns Array of filenames
     */
    public getFilenames(): string[] {
        const filenames = new Set(this.hotfixes.map((h) => h.filename));
        return Array.from(filenames).sort();
    }

    /**
     * Gets all unique sections for a specific filename
     * @param filename The filename to get sections for
     * @returns Array of section names
     */
    public getSectionsForFile(filename: string): string[] {
        const fileSections = this.hotfixes
            .filter((h) => h.filename === filename)
            .map((h) => h.section);
        return Array.from(new Set(fileSections)).sort();
    }

    /**
     * Parses an .ini file content into an array of hotfix objects.
     * This does not save to the database, it just returns the representation.
     * @param iniContent The string content of the .ini file
     * @param filename The filename this content belongs to
     * @returns An array of NewHotfix objects
     */
    public static parseIniToHotfixes(
        iniContent: string,
        filename: string
    ): NewHotfix[] {
        const hotfixes: NewHotfix[] = [];
        const lines = iniContent.split(/\r?\n/);
        let currentSection = "";

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine === "" || trimmedLine.startsWith(";")) {
                continue;
            }

            if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
                currentSection = trimmedLine.substring(1, trimmedLine.length - 1);
                continue;
            }

            if (currentSection) {
                const parsedHotfix = IniParser.parseKeyValuePair(
                    line,
                    filename,
                    currentSection
                );
                if (parsedHotfix) {
                    hotfixes.push(parsedHotfix);
                }
            }
        }

        return hotfixes;
    }

    /**
     * Parses a single line of an .ini file into a hotfix object.
     * @param line The line to parse
     * @param filename The filename of the hotfix
     * @param section The section the hotfix belongs to
     * @returns A NewHotfix object or null if parsing fails
     */
    public static parseKeyValuePair(
        line: string,
        filename: string,
        section: string
    ): NewHotfix | null {
        const parts = line.split(";");
        const keyValuePart = parts[0];
        const commentPart = parts.length > 1 ? parts.slice(1).join(";") : undefined;

        const keyValue = keyValuePart.split("=");
        if (keyValue.length < 2) {
            return null;
        }

        const key = keyValue[0].trim();
        const value = keyValue.slice(1).join("=").trim();

        const hotfix: NewHotfix = {
            filename,
            section,
            key,
            value,
            enabled: true,
        };

        if (commentPart) {
            const metadata = commentPart.trim();
            const metaParts = metadata.split(",").map((p) => p.trim());

            for (const meta of metaParts) {
                if (meta === "disabled") {
                    hotfix.enabled = false;
                }
            }
        }

        return hotfix;
    }

    /**
     * Merges Epic hotfixes with database overrides intelligently
     *
     * Strategy:
     * 1. Parse Epic content into structured hotfixes
     * 2. Group Epic hotfixes by section
     * 3. For sections that exist in both Epic and database:
     *    - Remove Epic hotfixes that conflict with database ones (same key)
     *    - Add database hotfixes to the existing Epic section
     * 4. For database-only sections: create new sections
     * 5. Convert back to clean INI format without duplicate sections
     *
     * @param epicContent Raw INI content from Epic
     * @param databaseHotfixes Array of database hotfixes to merge in
     * @param filename The filename for parsing context
     * @returns Merged INI content with database overrides
     */
    public static mergeWithDatabaseOverrides(
        epicContent: string,
        databaseHotfixes: Hotfix[],
        filename: string
    ): string {
        // Parse Epic content into structured format
        const epicHotfixes = IniParser.parseIniToHotfixes(epicContent, filename);

        // Group Epic hotfixes by section for easy manipulation
        const epicSectionMap = new Map<string, any[]>();
        for (const hotfix of epicHotfixes) {
            if (!epicSectionMap.has(hotfix.section)) {
                epicSectionMap.set(hotfix.section, []);
            }
            epicSectionMap.get(hotfix.section)!.push(hotfix);
        }

        // Get unique sections that database hotfixes use
        const databaseSections = new Set(databaseHotfixes.map((h) => h.section));

        // Process each section that has database overrides
        for (const dbSection of databaseSections) {
            if (epicSectionMap.has(dbSection)) {
                // Section exists in both Epic and database - merge them
                const databaseKeysInSection = new Set(
                    databaseHotfixes
                        .filter((h) => h.section === dbSection)
                        .map((h) => h.key)
                );

                // Keep Epic hotfixes that don't conflict with database ones
                const nonConflictingEpicHotfixes = epicSectionMap
                    .get(dbSection)!
                    .filter((epicHotfix) => !databaseKeysInSection.has(epicHotfix.key));

                // Add database hotfixes to this section (they take precedence)
                const databaseHotfixesInSection = databaseHotfixes.filter(
                    (h) => h.section === dbSection
                );

                // Replace the section with merged content
                epicSectionMap.set(dbSection, [
                    ...nonConflictingEpicHotfixes,
                    ...databaseHotfixesInSection,
                ]);
            } else {
                // Section doesn't exist in Epic - create new section with database hotfixes
                const databaseHotfixesInSection = databaseHotfixes.filter(
                    (h) => h.section === dbSection
                );
                epicSectionMap.set(dbSection, databaseHotfixesInSection);
            }
        }

        // Convert merged data back to INI format
        return IniParser.generateCleanIniContent(epicSectionMap);
    }

    /**
     * Converts section map back to clean INI format
     * @param sectionMap Map of section names to hotfix arrays
     * @returns Clean INI formatted string
     */
    public static generateCleanIniContent(
        sectionMap: Map<string, any[]>
    ): string {
        const iniLines: string[] = [];

        for (const [sectionName, sectionHotfixes] of sectionMap) {
            if (sectionHotfixes.length === 0) continue;

            // Add section header
            iniLines.push(`[${sectionName}]`);

            // Add all hotfixes in this section
            for (const hotfix of sectionHotfixes) {
                let line = `${hotfix.key}=${hotfix.value}`;

                // Add metadata comments for database overrides
                if (hotfix.accountId) {
                    line += ` ; account:${hotfix.accountId}`;
                }

                iniLines.push(line);
            }

            // Add empty line after section
            iniLines.push("");
        }

        // Remove trailing empty line if present
        if (iniLines.length > 0 && iniLines[iniLines.length - 1] === "") {
            iniLines.pop();
        }

        return iniLines.join("\n");
    }

    /**
     * Combines two .ini file contents, with the first taking precedence over the second.
     * If both files define the same key in the same section, the first file's value will be used.
     * @param firstIniContent The content of the first .ini file (higher priority)
     * @param secondIniContent The content of the second .ini file (lower priority)
     * @param firstFilename The filename for the first .ini content
     * @param secondFilename The filename for the second .ini content (optional, defaults to firstFilename)
     * @param includeTimestamp Whether to include timestamp in the combined file (default: true)
     * @returns Combined .ini file content
     */
    public static combineIniFiles(
        firstIniContent: string,
        secondIniContent: string,
        firstFilename: string,
        secondFilename?: string,
        includeTimestamp: boolean = true
    ): string {
        // Use the same filename for both if not specified
        const actualSecondFilename = secondFilename || firstFilename;

        // Parse both INI contents into hotfix arrays
        const firstHotfixes = IniParser.parseIniToHotfixes(
            firstIniContent,
            firstFilename
        );
        const secondHotfixes = IniParser.parseIniToHotfixes(
            secondIniContent,
            actualSecondFilename
        );

        // Create a set to track unique combinations of (filename, section, key)
        const conflictKeys = new Set<string>();
        const mergedHotfixes: NewHotfix[] = [];

        // Add all hotfixes from the first file (higher priority)
        for (const hotfix of firstHotfixes) {
            const conflictKey = `${hotfix.filename}:${hotfix.section}:${hotfix.key}`;
            conflictKeys.add(conflictKey);
            mergedHotfixes.push(hotfix);
        }

        // Add hotfixes from the second file only if they don't conflict
        for (const hotfix of secondHotfixes) {
            const conflictKey = `${hotfix.filename}:${hotfix.section}:${hotfix.key}`;
            if (!conflictKeys.has(conflictKey)) {
                mergedHotfixes.push(hotfix);
            }
        }

        // Convert merged hotfixes back to INI format
        // Create a temporary IniParser instance to use the existing transformation logic
        const tempParser = new IniParser(mergedHotfixes as Hotfix[]);
        const fileMap = tempParser.transformToIniFiles(true, includeTimestamp);

        // If we have multiple filenames, combine all into one INI content
        if (firstFilename !== actualSecondFilename) {
            const allContent: string[] = [];

            for (const [filename, content] of fileMap) {
                allContent.push(`; Content from ${filename}`);
                allContent.push(content);
                allContent.push("");
            }

            // Remove trailing empty line
            if (allContent[allContent.length - 1] === "") {
                allContent.pop();
            }

            return allContent.join("\n");
        } else {
            // Single filename case
            return fileMap.get(firstFilename) || "";
        }
    }
}