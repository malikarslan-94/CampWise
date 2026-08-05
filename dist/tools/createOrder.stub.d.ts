import { z } from 'zod';
export declare const createOrderToolName = "create_order";
export declare const createOrderInputSchema: z.ZodObject<{
    planCode: z.ZodString;
    variationId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    userId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    travelDetails: z.ZodArray<z.ZodObject<{
        startDate: z.ZodString;
        endDate: z.ZodString;
        countryCode: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startDate: string;
        endDate: string;
        countryCode: string;
    }, {
        startDate: string;
        endDate: string;
        countryCode: string;
    }>, "many">;
    promoCode: z.ZodOptional<z.ZodString>;
    paymentGateway: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    planCode: string;
    userId: string;
    travelDetails: {
        startDate: string;
        endDate: string;
        countryCode: string;
    }[];
    quantity: number;
    variationId?: string | number | undefined;
    promoCode?: string | undefined;
    paymentGateway?: string | undefined;
}, {
    planCode: string;
    userId: string;
    travelDetails: {
        startDate: string;
        endDate: string;
        countryCode: string;
    }[];
    variationId?: string | number | undefined;
    promoCode?: string | undefined;
    quantity?: number | undefined;
    paymentGateway?: string | undefined;
}>;
export declare const createOrderToolDef: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        planCode: z.ZodString;
        variationId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        userId: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
        travelDetails: z.ZodArray<z.ZodObject<{
            startDate: z.ZodString;
            endDate: z.ZodString;
            countryCode: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            startDate: string;
            endDate: string;
            countryCode: string;
        }, {
            startDate: string;
            endDate: string;
            countryCode: string;
        }>, "many">;
        promoCode: z.ZodOptional<z.ZodString>;
        paymentGateway: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        planCode: string;
        userId: string;
        travelDetails: {
            startDate: string;
            endDate: string;
            countryCode: string;
        }[];
        quantity: number;
        variationId?: string | number | undefined;
        promoCode?: string | undefined;
        paymentGateway?: string | undefined;
    }, {
        planCode: string;
        userId: string;
        travelDetails: {
            startDate: string;
            endDate: string;
            countryCode: string;
        }[];
        variationId?: string | number | undefined;
        promoCode?: string | undefined;
        quantity?: number | undefined;
        paymentGateway?: string | undefined;
    }>;
};
export declare function handleCreateOrder(_args: unknown): Promise<void>;
//# sourceMappingURL=createOrder.stub.d.ts.map