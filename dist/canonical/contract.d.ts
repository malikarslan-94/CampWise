import { z } from 'zod';
export declare const CanonicalVariationSchema: z.ZodObject<{
    variationId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    packageCode: z.ZodOptional<z.ZodString>;
    dataSize: z.ZodOptional<z.ZodString>;
    days: z.ZodOptional<z.ZodNumber>;
    price: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    variationId: string | number;
    price: number;
    packageCode?: string | undefined;
    dataSize?: string | undefined;
    days?: number | undefined;
}, {
    variationId: string | number;
    price: number;
    packageCode?: string | undefined;
    dataSize?: string | undefined;
    days?: number | undefined;
}>;
export type CanonicalVariation = z.infer<typeof CanonicalVariationSchema>;
export declare const CanonicalPlanSchema: z.ZodObject<{
    planCode: z.ZodString;
    planName: z.ZodString;
    productType: z.ZodString;
    dataVolume: z.ZodOptional<z.ZodString>;
    validityDays: z.ZodOptional<z.ZodNumber>;
    price: z.ZodNumber;
    currency: z.ZodString;
    variations: z.ZodArray<z.ZodObject<{
        variationId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
        packageCode: z.ZodOptional<z.ZodString>;
        dataSize: z.ZodOptional<z.ZodString>;
        days: z.ZodOptional<z.ZodNumber>;
        price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        variationId: string | number;
        price: number;
        packageCode?: string | undefined;
        dataSize?: string | undefined;
        days?: number | undefined;
    }, {
        variationId: string | number;
        price: number;
        packageCode?: string | undefined;
        dataSize?: string | undefined;
        days?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
export type CanonicalPlan = z.infer<typeof CanonicalPlanSchema>;
export declare const CanonicalSearchPlansRequestSchema: z.ZodObject<{
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
export type CanonicalSearchPlansRequest = z.infer<typeof CanonicalSearchPlansRequestSchema>;
export declare const CanonicalSearchPlansResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    plans: z.ZodArray<z.ZodObject<{
        planCode: z.ZodString;
        planName: z.ZodString;
        productType: z.ZodString;
        dataVolume: z.ZodOptional<z.ZodString>;
        validityDays: z.ZodOptional<z.ZodNumber>;
        price: z.ZodNumber;
        currency: z.ZodString;
        variations: z.ZodArray<z.ZodObject<{
            variationId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
            packageCode: z.ZodOptional<z.ZodString>;
            dataSize: z.ZodOptional<z.ZodString>;
            days: z.ZodOptional<z.ZodNumber>;
            price: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            variationId: string | number;
            price: number;
            packageCode?: string | undefined;
            dataSize?: string | undefined;
            days?: number | undefined;
        }, {
            variationId: string | number;
            price: number;
            packageCode?: string | undefined;
            dataSize?: string | undefined;
            days?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>, "many">;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
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
    message?: string | undefined;
}, {
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
    message?: string | undefined;
}>;
export type CanonicalSearchPlansResponse = z.infer<typeof CanonicalSearchPlansResponseSchema>;
export declare const TravelDetailSchema: z.ZodObject<{
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
}>;
export type TravelDetail = z.infer<typeof TravelDetailSchema>;
export declare const CanonicalPricingRequestSchema: z.ZodObject<{
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
    quantity: z.ZodNumber;
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
    quantity: number;
    variationId?: string | number | undefined;
    packageCode?: string | undefined;
    promoCode?: string | undefined;
    userId?: string | undefined;
    appUserId?: string | undefined;
    paymentGateway?: string | undefined;
}>;
export type CanonicalPricingRequest = z.infer<typeof CanonicalPricingRequestSchema>;
export declare const PerCountryBreakdownSchema: z.ZodObject<{
    countryCode: z.ZodString;
    days: z.ZodNumber;
    rate: z.ZodNumber;
    charges: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    days: number;
    countryCode: string;
    rate: number;
    charges: number;
}, {
    days: number;
    countryCode: string;
    rate: number;
    charges: number;
}>;
export declare const CanonicalPricingResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    promoDiscount: z.ZodOptional<z.ZodNumber>;
    perCountryBreakdown: z.ZodOptional<z.ZodArray<z.ZodObject<{
        countryCode: z.ZodString;
        days: z.ZodNumber;
        rate: z.ZodNumber;
        charges: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        days: number;
        countryCode: string;
        rate: number;
        charges: number;
    }, {
        days: number;
        countryCode: string;
        rate: number;
        charges: number;
    }>, "many">>;
    quoteValidUntil: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
export type CanonicalPricingResponse = z.infer<typeof CanonicalPricingResponseSchema>;
export declare const CanonicalCoverageRequestSchema: z.ZodObject<{
    planCode: z.ZodOptional<z.ZodString>;
    destinationCountry: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    planCode?: string | undefined;
    destinationCountry?: string | undefined;
}, {
    planCode?: string | undefined;
    destinationCountry?: string | undefined;
}>;
export type CanonicalCoverageRequest = z.infer<typeof CanonicalCoverageRequestSchema>;
export declare const CoverageCountrySchema: z.ZodObject<{
    countryCode: z.ZodString;
    countryName: z.ZodString;
    region: z.ZodOptional<z.ZodString>;
    rate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    countryCode: string;
    countryName: string;
    rate?: number | undefined;
    region?: string | undefined;
}, {
    countryCode: string;
    countryName: string;
    rate?: number | undefined;
    region?: string | undefined;
}>;
export declare const CanonicalCoverageResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    countries: z.ZodArray<z.ZodObject<{
        countryCode: z.ZodString;
        countryName: z.ZodString;
        region: z.ZodOptional<z.ZodString>;
        rate: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        countryCode: string;
        countryName: string;
        rate?: number | undefined;
        region?: string | undefined;
    }, {
        countryCode: string;
        countryName: string;
        rate?: number | undefined;
        region?: string | undefined;
    }>, "many">;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    countries: {
        countryCode: string;
        countryName: string;
        rate?: number | undefined;
        region?: string | undefined;
    }[];
    message?: string | undefined;
}, {
    ok: boolean;
    countries: {
        countryCode: string;
        countryName: string;
        rate?: number | undefined;
        region?: string | undefined;
    }[];
    message?: string | undefined;
}>;
export type CanonicalCoverageResponse = z.infer<typeof CanonicalCoverageResponseSchema>;
export declare const CanonicalOrderStatusRequestSchema: z.ZodObject<{
    userId: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    orderId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    phone?: string | undefined;
    orderId?: string | undefined;
}, {
    userId: string;
    phone?: string | undefined;
    orderId?: string | undefined;
}>;
export type CanonicalOrderStatusRequest = z.infer<typeof CanonicalOrderStatusRequestSchema>;
export declare const OrderSchema: z.ZodObject<{
    orderId: z.ZodString;
    orderStatus: z.ZodString;
    planCode: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodOptional<z.ZodString>;
    travelingTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    orderStatus: string;
    planCode?: string | undefined;
    deviceType?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    travelingTo?: string | undefined;
}, {
    orderId: string;
    orderStatus: string;
    planCode?: string | undefined;
    deviceType?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    travelingTo?: string | undefined;
}>;
export declare const CanonicalOrderStatusResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    orders: z.ZodArray<z.ZodObject<{
        orderId: z.ZodString;
        orderStatus: z.ZodString;
        planCode: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        deviceType: z.ZodOptional<z.ZodString>;
        travelingTo: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        orderId: string;
        orderStatus: string;
        planCode?: string | undefined;
        deviceType?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        travelingTo?: string | undefined;
    }, {
        orderId: string;
        orderStatus: string;
        planCode?: string | undefined;
        deviceType?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        travelingTo?: string | undefined;
    }>, "many">;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    orders: {
        orderId: string;
        orderStatus: string;
        planCode?: string | undefined;
        deviceType?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        travelingTo?: string | undefined;
    }[];
    message?: string | undefined;
}, {
    ok: boolean;
    orders: {
        orderId: string;
        orderStatus: string;
        planCode?: string | undefined;
        deviceType?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        travelingTo?: string | undefined;
    }[];
    message?: string | undefined;
}>;
export type CanonicalOrderStatusResponse = z.infer<typeof CanonicalOrderStatusResponseSchema>;
//# sourceMappingURL=contract.d.ts.map