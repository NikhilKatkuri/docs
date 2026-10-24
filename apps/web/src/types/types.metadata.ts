export const CLIENT_METADATA_HEADER = 'X-Docs-Client-Meta';

export const CLIENT_METADATA_MAX_BYTES = 2048;

export const METADATA_LIMITS = {
    name: 80,
    version: 40,
    label: 300,
    userAgentRaw: 500,
    ipAddress: 100,
} as const;

export interface ClientBrowserMetadata {
    family?: string;
    version?: string;
}

export interface ClientOsMetadata {
    family?: string;
    version?: string;
}

export interface ClientDeviceMetadata {
    type?: string;
    brand?: string;
    model?: string;
}

export interface ClientMetadata {
    browser?: ClientBrowserMetadata;
    os?: ClientOsMetadata;
    device?: ClientDeviceMetadata;
    platform?: string;
    mobile?: boolean;
}

export interface GeoLocation {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
}

export interface ServerMetadata {
    ip: string | null;
    userAgent: string | null;
    browser: ClientBrowserMetadata | null;
    os: ClientOsMetadata | null;
    device: ClientDeviceMetadata | null;
    receivedAt: string;
    forwardedFor: string | null;
    proxyTrusted: boolean;
    secure: boolean | undefined;
    location: GeoLocation | null;
}

export interface RequestMetadata {
    client: ClientMetadata | null;
    server: ServerMetadata;
}
