import { AnalyticsEngineAPI } from "../../app/analytics/query";
import { ColumnMappings } from "../../app/analytics/schema";
import {
    type Data,
    Float64,
    RecordBatch,
    Schema,
    Table,
    Utf8,
    makeData,
    tableToIPC,
} from "apache-arrow";
import dayjs from "dayjs";

type RecordValue = string | number | null | undefined;
type Record = { [key: string]: RecordValue };

// Build a Utf8 Data buffer directly from an array of strings.
// Bypasses apache-arrow's Builder path, which uses `new Function()` for
// validity-checking codegen and is forbidden by the Cloudflare Workers
// runtime ("Code generation from strings disallowed for this context").
function buildUtf8Data(values: (string | null | undefined)[]): Data<Utf8> {
    const encoder = new TextEncoder();
    const encoded: Uint8Array[] = new Array(values.length);
    let totalBytes = 0;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const bytes = v == null ? new Uint8Array(0) : encoder.encode(String(v));
        encoded[i] = bytes;
        totalBytes += bytes.length;
    }
    const valueOffsets = new Int32Array(values.length + 1);
    const data = new Uint8Array(totalBytes);
    let pos = 0;
    for (let i = 0; i < values.length; i++) {
        valueOffsets[i] = pos;
        data.set(encoded[i], pos);
        pos += encoded[i].length;
    }
    valueOffsets[values.length] = pos;
    return makeData({
        type: new Utf8(),
        length: values.length,
        nullCount: 0,
        valueOffsets,
        data,
    });
}

function buildFloat64Data(values: (number | null | undefined)[]): Data<Float64> {
    const buf = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++) {
        buf[i] = values[i] ?? 0;
    }
    return makeData({
        type: new Float64(),
        length: values.length,
        nullCount: 0,
        data: buf,
    });
}

// Convert an array of homogeneous records to an Arrow Table without invoking
// the Builder/`new Function()` codegen path. Column type is inferred from the
// first non-null sample per column: `number` → Float64, otherwise → Utf8.
export function recordsToTable(records: Record[]): Table {
    if (records.length === 0) {
        return new Table(new Schema([]));
    }
    const columnNames = Object.keys(records[0]);
    const children: { [name: string]: Data } = {};
    for (const name of columnNames) {
        let sample: RecordValue = undefined;
        for (const r of records) {
            const v = r[name];
            if (v != null) {
                sample = v;
                break;
            }
        }
        const values = records.map((r) => r[name]);
        if (typeof sample === "number") {
            children[name] = buildFloat64Data(values as (number | null)[]);
        } else {
            children[name] = buildUtf8Data(
                values.map((v) => (v == null ? null : String(v))),
            );
        }
    }
    return new Table(new RecordBatch(children));
}

export async function extractAsArrow(
    { accountId, bearerToken }: { accountId: string; bearerToken: string },
    bucket: R2Bucket,
) {
    const api = new AnalyticsEngineAPI(accountId, bearerToken);

    // Get yesterday's date range
    const yesterday = dayjs().subtract(1, "day");
    const startDateTime = yesterday.startOf("day").toDate();
    const endDateTime = yesterday.endOf("day").toDate();

    // Get all columns we want to extract
    const columns = Object.keys(ColumnMappings).filter(
        (key) => key !== "siteId" && key !== "newVisitor" && key !== "bounce",
    ) as (keyof typeof ColumnMappings)[];

    // Fetch data for yesterday
    const data = await api.getAllCountsByAllColumnsForAllSites(
        columns,
        startDateTime,
        endDateTime,
    );

    // Convert Map to array of records for Arrow table creation
    const records: Record[] = [];
    data.forEach((counts, key) => {
        const [date, siteId, ...columnValues] = key;
        const record: Record = {
            date,
            siteId,
            views: counts.views,
            visitors: counts.visitors,
            bounces: counts.bounces,
        };

        // Add column values
        columns.forEach((column, index) => {
            record[column] = columnValues[index];
        });

        records.push(record);
    });

    // Build Arrow table without invoking codegen-based builders.
    const table = recordsToTable(records);

    // Convert to Arrow IPC buffer
    const arrowBuffer = new Uint8Array(tableToIPC(table, "file"));

    // Generate filename with yesterday's date
    const filename = `analytics-${yesterday.format("YYYY-MM-DD")}.arrow`;

    // Save to R2
    await bucket.put(filename, arrowBuffer);

    console.log(`Saved ${records.length} records to ${filename}`);

    return { filename, recordCount: records.length };
}

// IIFE for testing
if (import.meta.url === `file://${process.argv[1]}`) {
    (async () => {
        // Mock R2 bucket for local testing
        const mockBucket = {
            put: async (filename: string, data: Uint8Array) => {
                console.log(
                    `Mock: Would save ${data.length} bytes to ${filename}`,
                );
                return {
                    key: filename,
                    version: "mock",
                    size: data.length,
                    etag: "mock",
                    httpEtag: "mock",
                    uploaded: new Date(),
                    checksums: { md5: "mock", sha1: "mock", sha256: "mock" },
                    storageClass: "STANDARD",
                    writeHttpMetadata: {},
                };
            },
            head: async () => null,
            get: async () => null,
            delete: async () => {},
            createMultipartUpload: async () => ({
                uploadId: "mock",
                key: "mock",
                uploadPart: async () => ({ partNumber: 1, etag: "mock" }),
                abort: async () => {},
                complete: async () => ({
                    key: "mock",
                    version: "mock",
                    size: 0,
                    etag: "mock",
                    httpEtag: "mock",
                    uploaded: new Date(),
                    checksums: { md5: "mock", sha1: "mock", sha256: "mock" },
                    storageClass: "STANDARD",
                    writeHttpMetadata: {},
                }),
            }),
            resumeMultipartUpload: async () => ({
                uploadId: "mock",
                key: "mock",
                uploadPart: async () => ({ partNumber: 1, etag: "mock" }),
                abort: async () => {},
                complete: async () => ({
                    key: "mock",
                    version: "mock",
                    size: 0,
                    etag: "mock",
                    httpEtag: "mock",
                    uploaded: new Date(),
                    checksums: { md5: "mock", sha1: "mock", sha256: "mock" },
                    storageClass: "STANDARD",
                    writeHttpMetadata: {},
                }),
            }),
            list: async () => ({
                objects: [],
                delimitedPrefixes: [],
                truncated: false,
            }),
        } as unknown as R2Bucket;

        // Get credentials from environment variables
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const bearerToken = process.env.CLOUDFLARE_API_TOKEN;

        if (!accountId || !bearerToken) {
            console.error(
                "Error: Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables",
            );
            process.exit(1);
        }

        try {
            const result = await extractAsArrow(
                { accountId, bearerToken },
                mockBucket,
            );
            console.log("Success:", result);
        } catch (error) {
            console.error("Error:", error);
            process.exit(1);
        }
    })();
}
