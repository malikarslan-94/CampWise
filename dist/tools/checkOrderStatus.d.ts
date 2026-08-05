import { z } from 'zod';
export declare const checkOrderStatusToolName = "check_order_status";
export declare const checkOrderStatusInputSchema: z.ZodObject<{
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
export declare const checkOrderStatusToolDef: {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
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
};
export declare function handleCheckOrderStatus(args: unknown): Promise<{
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
//# sourceMappingURL=checkOrderStatus.d.ts.map