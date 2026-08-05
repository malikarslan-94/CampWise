import { UpstreamError } from './errors.js';
import { getLogger } from './logger.js';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
async function fetchWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
function isRetryable(status) {
    return status >= 500;
}
function safeHost(url) {
    try {
        return new URL(url).host;
    }
    catch {
        return '[invalid-url]';
    }
}
export async function httpPost(url, options = {}) {
    const { method = 'POST', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, logContext = {}, } = options;
    const logger = getLogger(logContext);
    const host = safeHost(url);
    const init = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    let lastError;
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
            const data = (await res.json());
            return { status: res.status, data };
        }
        catch (err) {
            const latencyMs = Date.now() - start;
            if (err instanceof UpstreamError)
                throw err;
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
export async function httpGet(url, options = {}) {
    return httpPost(url, { ...options, method: 'GET', body: undefined });
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=httpClient.js.map