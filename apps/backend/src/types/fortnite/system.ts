export type SystemJSONResponse = {
    uniqueFilename: string;
    filename: string;
    hash: string;
    hash256: string;
    length: number;
    contentType: string;
    uploaded: string;
    storageType: string;
    storageIds: Record<string, string>;
    doNotCache: boolean;
};