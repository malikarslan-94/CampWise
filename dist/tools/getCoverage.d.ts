import { z } from 'zod';
export declare const getCoverageToolName = "get_coverage";
export declare const getCoverageInputSchema: z.ZodObject<{
    planCode: z.ZodOptional<z.ZodString>;
    destinationCountry: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    planCode?: string | undefined;
    destinationCountry?: string | undefined;
}, {
    planCode?: string | undefined;
    destinationCountry?: string | undefined;
}>;
export declare const getCoverageToolDef: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        planCode: z.ZodOptional<z.ZodString>;
        destinationCountry: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        planCode?: string | undefined;
        destinationCountry?: string | undefined;
    }, {
        planCode?: string | undefined;
        destinationCountry?: string | undefined;
    }>;
};
export declare function handleGetCoverage(args: unknown): Promise<{
    ok: boolean;
    countries: {
        countryCode: string;
        countryName: string;
        rate?: number | undefined;
        region?: string | undefined;
    }[];
    message?: string | undefined;
}>;
//# sourceMappingURL=getCoverage.d.ts.map