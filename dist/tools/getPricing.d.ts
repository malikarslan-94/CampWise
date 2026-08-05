import { z } from 'zod';
export declare const getPricingToolName = "get_pricing";
export declare const getPricingInputSchema: z.ZodObject<{
    planCode: z.ZodString;
    packageCode: z.ZodOptional<z.ZodString>;
    variationId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    destinationCountries: z.ZodArray<z.ZodString, "many">;
    travelDetails: z.ZodArray<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        countryCode: z.ZodString;
        countryName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        countryCode: string;
        countryName?: string | undefined;
    }, {
        startDate: string;
        endDate: string;
        countryCode: string;
        countryName?: string | undefined;
    }>, "many">;
    quantity: z.ZodDefault<z.ZodNumber>;
    promoCode: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    appUserId: z.ZodOptional<z.ZodString>;
    paymentGateway: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    planCode: string;
    destinationCountries: string[];
    startDate: string;
    endDate: string;
    travelDetails: {
        startDate: string;
        endDate: string;
        countryCode: string;
        countryName?: string | undefined;
    }[];
    quantity: number;
    variationId?: string | number | undefined;
    packageCode?: string | undefined;
    promoCode?: string | undefined;
    userId?: string | undefined;
    appUserId?: string | undefined;
    paymentGateway?: string | undefined;
}, {
    planCode: string;
    destinationCountries: string[];
    startDate: string;
    endDate: string;
    travelDetails: {
        startDate: string;
        endDate: string;
        countryCode: string;
        countryName?: string | undefined;
    }[];
    variationId?: string | number | undefined;
    packageCode?: string | undefined;
    promoCode?: string | undefined;
    userId?: string | undefined;
    quantity?: number | undefined;
    appUserId?: string | undefined;
    paymentGateway?: string | undefined;
}>;
export declare const getPricingToolDef: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        planCode: z.ZodString;
        packageCode: z.ZodOptional<z.ZodString>;
        variationId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        startDate: z.ZodString;
        endDate: z.ZodString;
        destinationCountries: z.ZodArray<z.ZodString, "many">;
        travelDetails: z.ZodArray<z.ZodObject<{
            startDate: z.ZodString;
            endDate: z.ZodString;
            countryCode: z.ZodString;
            countryName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            startDate: string;
            endDate: string;
            countryCode: string;
            countryName?: string | undefined;
        }, {
            startDate: string;
            endDate: string;
            countryCode: string;
            countryName?: string | undefined;
        }>, "many">;
        quantity: z.ZodDefault<z.ZodNumber>;
        promoCode: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        appUserId: z.ZodOptional<z.ZodString>;
        paymentGateway: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        planCode: string;
        destinationCountries: string[];
        startDate: string;
        endDate: string;
        travelDetails: {
            startDate: string;
            endDate: string;
            countryCode: string;
            countryName?: string | undefined;
        }[];
        quantity: number;
        variationId?: string | number | undefined;
        packageCode?: string | undefined;
        promoCode?: string | undefined;
        userId?: string | undefined;
        appUserId?: string | undefined;
        paymentGateway?: string | undefined;
    }, {
        planCode: string;
        destinationCountries: string[];
        startDate: string;
        endDate: string;
        travelDetails: {
            startDate: string;
            endDate: string;
            countryCode: string;
            countryName?: string | undefined;
        }[];
        variationId?: string | number | undefined;
        packageCode?: string | undefined;
        promoCode?: string | undefined;
        userId?: string | undefined;
        quantity?: number | undefined;
        appUserId?: string | undefined;
        paymentGateway?: string | undefined;
    }>;
};
export declare function handleGetPricing(args: unknown): Promise<{
    ok: boolean;
    message?: string | undefined;
    currency?: string | undefined;
    totalAmount?: number | undefined;
    promoDiscount?: number | undefined;
    perCountryBreakdown?: {
        days: number;
        countryCode: string;
        rate: number;
        charges: number;
    }[] | undefined;
    quoteValidUntil?: string | undefined;
}>;
//# sourceMappingURL=getPricing.d.ts.map