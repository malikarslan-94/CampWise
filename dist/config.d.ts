import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    PORT: z.ZodEffects<z.ZodString, number, string>;
    SERVICE_API_KEY: z.ZodString;
    REGISTRY_PATH: z.ZodString;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["trace", "debug", "info", "warn", "error", "fatal"]>>;
}, "strip", z.ZodTypeAny, {
    LOG_LEVEL: "info" | "fatal" | "error" | "warn" | "debug" | "trace";
    REGISTRY_PATH: string;
    PORT: number;
    SERVICE_API_KEY: string;
}, {
    REGISTRY_PATH: string;
    PORT: string;
    SERVICE_API_KEY: string;
    LOG_LEVEL?: "info" | "fatal" | "error" | "warn" | "debug" | "trace" | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(): Config;
/**
 * After the registry is loaded, verifies every *Ref env var named in tenant
 * records actually exists in process.env. Exits with a clear error if not.
 */
export declare function validateSecretRefs(): void;
export declare function getConfig(): Config;
export {};
//# sourceMappingURL=config.d.ts.map