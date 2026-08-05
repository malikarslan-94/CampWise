import type { z } from 'zod';
import type { AuthState } from '../ai/session/types.js';
import { searchPlansToolDef, handleSearchPlans } from './searchPlans.js';
import { getPricingToolDef, handleGetPricing } from './getPricing.js';
import { getCoverageToolDef, handleGetCoverage } from './getCoverage.js';
import { checkOrderStatusToolDef, handleCheckOrderStatus } from './checkOrderStatus.js';
import { createOrderToolDef, handleCreateOrder } from './createOrder.stub.js';

/**
 * One table of tools, shared by the MCP transport and the chat module.
 *
 * `requiresAuth` is the single place that decides which tools a signed-out caller
 * may reach. It drives two things: which tools appear on the model's menu, and a
 * belt-and-braces check inside the invoker. The menu is the real control — a tool
 * the model was never shown cannot be argued for — but the invoker refusing as well
 * costs nothing and closes the gap if a menu is ever built wrongly.
 */
export interface ToolEntry {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<unknown>;
  /** True when the tool returns data belonging to a specific person. */
  requiresAuth: boolean;
  /** Registered for MCP clients but not offered to the chat model. */
  hiddenFromChat?: boolean;
}

export const TOOLS: ToolEntry[] = [
  { ...searchPlansToolDef, handler: handleSearchPlans, requiresAuth: false },
  { ...getPricingToolDef, handler: handleGetPricing, requiresAuth: false },
  { ...getCoverageToolDef, handler: handleGetCoverage, requiresAuth: false },
  { ...checkOrderStatusToolDef, handler: handleCheckOrderStatus, requiresAuth: true },
  {
    ...createOrderToolDef,
    handler: handleCreateOrder,
    requiresAuth: true,
    // Phase 2 write path. An LLM must not place an order on its own — it needs
    // idempotency, payment handling and explicit user confirmation first.
    hiddenFromChat: true,
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolEntry | undefined {
  return BY_NAME.get(name);
}

/**
 * The tools a session may use, decided by its auth state alone.
 *
 * The caller's message is never inspected — there is no classifier asking "is this
 * personal?". An anonymous session gets the same three tools whether the question is
 * about Japan, about their orders, or about the weather. Understanding the question
 * is the model's job; deciding what exists is this function's.
 */
export function toolsForAuth(auth: AuthState): ToolEntry[] {
  return TOOLS.filter((t) => !t.hiddenFromChat && (!t.requiresAuth || auth === 'user'));
}
