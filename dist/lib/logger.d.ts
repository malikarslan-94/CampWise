import pino from 'pino';
export declare const rootLogger: pino.Logger<never, boolean>;
export interface LogContext {
    tenantId?: string;
    toolName?: string;
    requestId?: string;
    latencyMs?: number;
    [key: string]: unknown;
}
export declare function getLogger(ctx: LogContext): pino.Logger<never, boolean>;
//# sourceMappingURL=logger.d.ts.map