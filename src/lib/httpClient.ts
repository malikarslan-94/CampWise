import { UpstreamError } from './errors.js';
import { getLogger } from './logger.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** For logging only — never include query params or secrets */
  logContext?: { tenantId?: string; toolName?: string; family?: string; requestId?: string };
}

export interface HttpResponse<T> {
  status: number;
  data: T;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(status: number): boolean {
  return status >= 500;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '[invalid-url]';
  }
}

export async function httpPost<T = unknown>(
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpResponse<T>> {
  const {
    method = 'POST',
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logContext = {},
  } = options;

  const logger = getLogger(logContext);
  const host = safeHost(url);

  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      const latencyMs = Date.now() - start;

      logger.info({ host, status: res.status, latencyMs, attempt }, 'upstream_call');

      if (!res.ok && !isRetryable(res.status)) {
        // 4xx — do not retry, surface a typed error
        throw new UpstreamError(`Upstream returned ${res.status}`, res.status);
      }

      if (!res.ok) {
        // 5xx — throw to trigger retry
        lastError = new UpstreamError(`Upstream returned ${res.status}`, res.status);
        if (attempt < MAX_RETRIES) {
          await sleep(200 * 2 ** attempt);
          continue;
        }
        throw lastError;
      }

      const data = (await res.json()) as T;
      return { status: res.status, data };
    } catch (err) {
      const latencyMs = Date.now() - start;
      if (err instanceof UpstreamError) throw err;

      // Network / timeout errors are retryable
      lastError = err;
      logger.warn({ host, latencyMs, attempt, err: String(err) }, 'upstream_network_error');
      if (attempt < MAX_RETRIES) {
        await sleep(200 * 2 ** attempt);
      }
    }
  }

  throw new UpstreamError('Upstream request failed after retries');
}

export async function httpGet<T = unknown>(
  url: string,
  options: Omit<HttpRequestOptions, 'body'> = {},
): Promise<HttpResponse<T>> {
  return httpPost<T>(url, { ...options, method: 'GET', body: undefined });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
