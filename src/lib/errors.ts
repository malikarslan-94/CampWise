export class TenantNotFoundError extends Error {
  readonly code = 'TENANT_NOT_FOUND';
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = 'TenantNotFoundError';
  }
}

export class ToolNotAllowedError extends Error {
  readonly code = 'TOOL_NOT_ALLOWED';
  constructor(tool: string, tenantId: string) {
    super(`Tool '${tool}' is not allowed for tenant '${tenantId}'`);
    this.name = 'ToolNotAllowedError';
  }
}

export class RateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';
  /** Which limit tripped — for logs and metrics. Never surfaced to the caller. */
  readonly dimension: string;
  constructor(scope: string, dimension = 'tenant') {
    super(`Rate limit exceeded (${dimension}: '${scope}')`);
    this.name = 'RateLimitedError';
    this.dimension = dimension;
  }
}

export class UpstreamError extends Error {
  readonly code = 'UPSTREAM_ERROR';
  readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'UpstreamError';
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GroundingFailedError extends Error {
  readonly code = 'GROUNDING_FAILED';
  constructor(planCode: string) {
    super(`Plan '${planCode}' failed grounding verification`);
    this.name = 'GroundingFailedError';
  }
}

export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED';
  constructor(feature: string) {
    super(`${feature} is not available in this phase`);
    this.name = 'NotImplementedError';
  }
}

export class TenantContextMissingError extends Error {
  readonly code = 'TENANT_CONTEXT_MISSING';
  constructor() {
    super('Tenant context is required but was not provided');
    this.name = 'TenantContextMissingError';
  }
}

export class AuthenticationError extends Error {
  readonly code = 'AUTHENTICATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/** Maps internal errors to safe, user-facing messages. */
export function toSafeMessage(err: unknown): string {
  if (err instanceof TenantNotFoundError) return 'Service configuration error. Please try again.';
  if (err instanceof ToolNotAllowedError) return 'This operation is not available for your account.';
  if (err instanceof RateLimitedError) return 'Too many requests. Please wait a moment and try again.';
  if (err instanceof UpstreamError) return 'An upstream service error occurred. Please try again.';
  if (err instanceof ValidationError) return `Invalid request: ${err.message}`;
  if (err instanceof GroundingFailedError) return 'Plan information could not be verified. Please search again.';
  if (err instanceof NotImplementedError) return err.message;
  if (err instanceof TenantContextMissingError) return 'Service context is missing. Please try again.';
  return 'An unexpected error occurred. Please try again.';
}
