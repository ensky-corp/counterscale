import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { FilterValue, SearchFilters } from "~/lib/types";

dayjs.extend(utc);
dayjs.extend(timezone);

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function paramsFromUrl(url: string) {
    const searchParams = new URL(url).searchParams;
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

// Parse a raw URL search-param value into a FilterValue. A leading "!" denotes
// the ne (exclude) operator; everything else is treated as eq. See ADR-005.
function parseFilterValue(raw: string): FilterValue {
    if (raw.startsWith("!")) {
        return { op: "ne", value: raw.slice(1) };
    }
    return { op: "eq", value: raw };
}

// Serialise a FilterValue back to the URL-encoded form: "!value" for ne, bare
// value for eq. The inverse of parseFilterValue.
export function filterValueToParam(fv: FilterValue): string {
    return fv.op === "ne" ? `!${fv.value}` : fv.value;
}

const FILTER_KEYS: Array<keyof SearchFilters> = [
    "path",
    "referrer",
    "deviceType",
    "country",
    "browserName",
    "browserVersion",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmTerm",
    "utmContent",
];

export function getFiltersFromSearchParams(searchParams: URLSearchParams) {
    const filters: SearchFilters = {};

    for (const key of FILTER_KEYS) {
        if (searchParams.has(key)) {
            filters[key] = parseFilterValue(searchParams.get(key) || "");
        }
    }

    return filters;
}

export function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        // Fallback to UTC if browser doesn't support Intl API
        return "UTC";
    }
}

export function getIntervalType(interval: string): "DAY" | "HOUR" {
    switch (interval) {
        case "today":
        case "yesterday":
        case "1d":
            return "HOUR";
        case "7d":
        case "30d":
        case "90d":
            return "DAY";
        default:
            return "DAY";
    }
}

export function getDateTimeRange(interval: string, tz: string) {
    let localDateTime = dayjs().utc();
    let localEndDateTime: dayjs.Dayjs | undefined;

    if (interval === "today") {
        localDateTime = localDateTime.tz(tz).startOf("day");
    } else if (interval === "yesterday") {
        localDateTime = localDateTime.tz(tz).startOf("day").subtract(1, "day");
        localEndDateTime = localDateTime.endOf("day").add(2, "ms");
    } else {
        const daysAgo = Number(interval.split("d")[0]);
        const intervalType = getIntervalType(interval);

        if (intervalType === "DAY") {
            localDateTime = localDateTime
                .subtract(daysAgo, "day")
                .tz(tz)
                .startOf("day");
        } else if (intervalType === "HOUR") {
            localDateTime = localDateTime
                .subtract(daysAgo, "day")
                .startOf("hour");
        }
    }

    if (!localEndDateTime) {
        localEndDateTime = dayjs().utc().tz(tz);
    }

    return {
        startDate: localDateTime.toDate(),
        endDate: localEndDateTime.toDate(),
    };
}

export function maskBrowserVersion(version?: string) {
    if (!version) return version;

    const majorEnd = version.indexOf(".");

    if (majorEnd != -1) {
        version =
            version.substring(0, majorEnd) +
            version.slice(majorEnd).replaceAll(/\.[^.]+/g, ".x");
    }

    return version;
}
