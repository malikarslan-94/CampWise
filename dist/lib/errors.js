export class TenantNotFoundError extends Error {
    code = 'TENANT_NOT_FOUND';
    constructor(tenantId) {
        super(`Tenant not found: ${tenantId}`);
        this.name = 'TenantNotFoundError';
    }
}
export class ToolNotAllowedError extends Error {
    code = 'TOOL_NOT_ALLOWED';
    constructor(tool, tenantId) {
        super(`Tool '${tool}' is not allowed for tenant '${tenantId}'`);
        this.name = 'ToolNotAllowedError';
    }
}
export class RateLimitedError extends Error {
    code = 'RATE_LIMITED';
    constructor(tenantId) {
        super(`Rate limit exceeded for tenant '${tenantId}'`);
        this.name = 'RateLimitedError';
    }
}
export class UpstreamError extends Error {
    code = 'UPSTREAM_ERROR';
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.name = 'UpstreamError';
        this.statusCode = statusCode;
    }
}
export class ValidationError extends Error {
    code = 'VALIDATION_ERROR';
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
export class GroundingFailedError extends Error {
    code = 'GROUNDING_FAILED';
    constructor(planCode) {
        super(`Plan '${planCode}' failed grounding verification`);
        this.name = 'GroundingFailedError';
    }
}
export class NotImplementedError extends Error {
    code = 'NOT_IMPLEMENTED';
    constructor(feature) {
        super(`${feature} is not available in this phase`);
        this.name = 'NotImplementedError';
    }
}
export class TenantContextMissingError extends Error {
    code = 'TENANT_CONTEXT_MISSING';
    constructor() {
        super('Tenant context is required but was not provided');
        this.name = 'TenantContextMissingError';
    }
}
export class AuthenticationError extends Error {
    code = 'AUTHENTICATION_ERROR';
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}
/** Maps internal errors to safe, user-facing messages. */
export function toSafeMessage(err) {
    if (err instanceof TenantNotFoundError)
        return 'Service configuration error. Please try again.';
    if (err instanceof ToolNotAllowedError)
        return 'This operation is not available for your account.';
    if (err instanceof RateLimitedError)
        return 'Too many requests. Please wait a moment and try again.';
    if (err instanceof UpstreamError)
        return 'An upstream service error occurred. Please try again.';
    if (err instanceof ValidationError)
        return `Invalid request: ${err.message}`;
    if (err instanceof GroundingFailedError)
        return 'Plan information could not be verified. Please search again.';
    if (err instanceof NotImplementedError)
        return err.message;
    if (err instanceof TenantContextMissingError)
        return 'Service context is missing. Please try again.';
    return 'An unexpected error occurred. Please try again.';
}
//# sourceMappingURL=errors.js.map