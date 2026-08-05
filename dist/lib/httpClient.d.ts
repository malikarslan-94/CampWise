export interface HttpRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    /** For logging only — never include query params or secrets */
    logContext?: {
        tenantId?: string;
        toolName?: string;
        family?: string;
        requestId?: string;
    };
}
export interface HttpResponse<T> {
    status: number;
    data: T;
}
export declare function httpPost<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
export declare function httpGet<T = unknown>(url: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<HttpResponse<T>>;
//# sourceMappingURL=httpClient.d.ts.map