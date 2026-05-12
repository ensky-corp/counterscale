export type FilterOp = "eq" | "ne";

export interface FilterValue {
    op: FilterOp;
    value: string;
}

export interface SearchFilters {
    path?: FilterValue;
    referrer?: FilterValue;
    deviceModel?: FilterValue;
    deviceType?: FilterValue;
    country?: FilterValue;
    browserName?: FilterValue;
    browserVersion?: FilterValue;
    utmSource?: FilterValue;
    utmMedium?: FilterValue;
    utmCampaign?: FilterValue;
    utmTerm?: FilterValue;
    utmContent?: FilterValue;
}

export interface User {
    authenticated: boolean;
}
