import pino from 'pino';

/**
 * Structured logging to **stdout**, one JSON object per line.
 *
 *   LOG_LEVEL=trace|debug|info|warn|error|fatal   (default: info)
 *   LOG_PRETTY=1                                  human-readable dev format
 *
 * In production leave it as JSON and let the log collector parse it. `debug` traces
 * every step of a chat request; `info` records the outcomes worth alerting on.
 *
 * Every chat log line carries `tenantId`, `sessionId` and `requestId` where they are
 * known, so one conversation can be followed end to end through the gate, the
 * invoker, the resolver and the upstream call.
 */

const LEVEL_COLOUR: Record<string, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
};

/**
 * Minimal human-readable formatter for local development.
 * Deliberately not pino-pretty — that would be a dependency for a dev convenience.
 */
function prettyDestination() {
  return {
    write(line: string) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line);
      } catch {
        process.stdout.write(line);
        return;
      }

      const { level, time, msg, pid, hostname, ...rest } = parsed as Record<string, string>;
      void pid;
      void hostname;

      const clock = typeof time === 'string' ? time.slice(11, 23) : '';
      const colour = LEVEL_COLOUR[level] ?? '';
      const fields = Object.entries(rest)
        .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' ');

      process.stdout.write(
        `${clock} ${colour}${(level ?? '').padEnd(5)}\x1b[0m ${String(msg).padEnd(26)} ${fields}\n`,
      );
    },
  };
}

export const rootLogger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  process.env.LOG_PRETTY ? prettyDestination() : undefined,
);

export interface LogContext {
  tenantId?: string;
  toolName?: string;
  requestId?: string;
  sessionId?: string;
  latencyMs?: number;
  [key: string]: unknown;
}

export function getLogger(ctx: LogContext) {
  return rootLogger.child(ctx);
}
