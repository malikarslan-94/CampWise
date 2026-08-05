import pino from 'pino';
export const rootLogger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});
export function getLogger(ctx) {
    return rootLogger.child(ctx);
}
//# sourceMappingURL=logger.js.map