import type { IncomingMessage, ServerResponse } from 'node:http';

/** Bodies larger than this are rejected unread — a chat message is a few hundred bytes. */
export const MAX_BODY_BYTES = 32 * 1024;

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Body is not valid JSON'));
      }
    });

    req.on('error', reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

/**
 * CORS for the chat endpoints.
 *
 * The allowlist comes from the same origin→tenant map that resolves tenancy, so
 * there is one source of truth. Note this is a browser-side control only: a script
 * sets any Origin it likes. It is not what keeps tenants apart — `publicChat` is,
 * by ensuring every origin-reachable tenant serves data that is already public.
 */
export function applyCors(req: IncomingMessage, res: ServerResponse, allowed: Set<string>): void {
  const origin = req.headers.origin;
  if (!origin || !allowed.has(origin.toLowerCase().replace(/\/+$/, ''))) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
}

/** Best-effort client IP, honouring one proxy hop. */
export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}
