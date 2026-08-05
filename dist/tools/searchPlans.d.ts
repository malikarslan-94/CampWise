import { z } from 'zod';
export declare const searchPlansToolName = "search_plans";
export declare const searchPlansInputSchema: z.ZodObject<{
    originCountry: z.ZodString;
    destinationCountries: z.ZodArray<z.ZodString, "many">;
    durationDays: z.ZodOptional<z.ZodNumber>;
    deviceType: z.ZodOptional<z.ZodEnum<["esim", "device", "sim"]>>;
    promoCode: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    originCountry: string;
    destinationCountries: string[];
    durationDays?: number | undefined;
    deviceType?: "esim" | "device" | "sim" | undefined;
    promoCode?: string | undefined;
    userId?: string | undefined;
}, {
    originCountry: string;
    destinationCountries: string[];
    durationDays?: number | undefined;
    deviceType?: "esim" | "device" | "sim" | undefined;
    promoCode?: string | undefined;
    userId?: string | undefined;
}>;
export declare const searchPlansToolDef: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        originCountry: z.ZodString;
        destinationCountries: z.ZodArray<z.ZodString, "many">;
        durationDays: z.ZodOptional<z.ZodNumber>;
        deviceType: z.ZodOptional<z.ZodEnum<["esim", "device", "sim"]>>;
        promoCode: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        originCountry: string;
        destinationCountries: string[];
        durationDays?: number | undefined;
        deviceType?: "esim" | "device" | "sim" | undefined;
        promoCode?: string | undefined;
        userId?: string | undefined;
    }, {
        originCountry: string;
        destinationCountries: string[];
        durationDays?: number | undefined;
        deviceType?: "esim" | "device" | "sim" | undefined;
        promoCode?: string | undefined;
        userId?: string | undefined;
    }>;
};
export declare function handleSearchPlans(args: unknown): Promise<{
    ok: boolean;
    plans: {
        price: number;
        planCode: string;
        planName: string;
        productType: string;
        currency: string;
        variations: {
            variationId: string | number;
            price: number;
            packageCode?: string | undefined;
            dataSize?: string | undefined;
            days?: number | undefined;
        }[];
        dataVolume?: string | undefined;
        validityDays?: number | undefined;
    }[];
    message: string | undefined;
}>;
//# sourceMappingURL=searchPlans.d.ts.map