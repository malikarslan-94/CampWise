import { z } from 'zod';
import { NotImplementedError } from '../lib/errors.js';

export const createOrderToolName = 'create_order';

export const createOrderInputSchema = z.object({
  planCode: z.string(),
  variationId: z.union([z.string(), z.number()]).optional(),
  userId: z.string(),
  quantity: z.number().int().positive().default(1),
  travelDetails: z.array(z.object({
    startDate: z.string(),
    endDate: z.string(),
    countryCode: z.string(),
  })),
  promoCode: z.string().optional(),
  paymentGateway: z.string().optional(),
});

export const createOrderToolDef = {
  name: createOrderToolName,
  description: 'Create a new connectivity plan order for a user.',
  inputSchema: createOrderInputSchema,
};

export async function handleCreateOrder(_args: unknown) {
  throw new NotImplementedError('Order creation');
}
