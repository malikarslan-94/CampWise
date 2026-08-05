export declare class TenantNotFoundError extends Error {
    readonly code = "TENANT_NOT_FOUND";
    constructor(tenantId: string);
}
export declare class ToolNotAllowedError extends Error {
    readonly code = "TOOL_NOT_ALLOWED";
    constructor(tool: string, tenantId: string);
}
export declare class RateLimitedError extends Error {
    readonly code = "RATE_LIMITED";
    constructor(tenantId: string);
}
export declare class UpstreamError extends Error {
    readonly code = "UPSTREAM_ERROR";
    readonly statusCode?: number;
    constructor(message: string, statusCode?: number);
}
export declare class ValidationError extends Error {
    readonly code = "VALIDATION_ERROR";
    constructor(message: string);
}
export declare class GroundingFailedError extends Error {
    readonly code = "GROUNDING_FAILED";
    constructor(planCode: string);
}
export declare class NotImplementedError extends Error {
    readonly code = "NOT_IMPLEMENTED";
    constructor(feature: string);
}
export declare class TenantContextMissingError extends Error {
    readonly code = "TENANT_CONTEXT_MISSING";
    constructor();
}
export declare class AuthenticationError extends Error {
    readonly code = "AUTHENTICATION_ERROR";
    constructor(message: string);
}
/** Maps internal errors to safe, user-facing messages. */
export declare function toSafeMessage(err: unknown): string;
//# sourceMappingURL=errors.d.ts.map