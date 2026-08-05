import type { ChatReply, ChatResponder } from './routes.js';
import type { ToolInvoker } from './DirectToolInvoker.js';
import type { SessionData } from './session/types.js';

/**
 * Stands in for the model until phase F.
 *
 * It cannot understand a sentence, so it takes tool arguments from the request body
 * instead and invokes `search_plans` directly. That is enough to prove the whole
 * pipeline — gate, session, tenancy, locale, resolver, adapter, live upstream,
 * canonical response — before the LLM is anywhere near it.
 *
 * The point of building this order: when the model misbehaves in phase F, you
 * already know the plumbing underneath it works.
 */
export class StubResponder implements ChatResponder {
  constructor(
    private readonly invoker: ToolInvoker,
    private readonly defaultArgs: Record<string, unknown> = {
      originCountry: 'MY',
      destinationCountries: ['JP'],
      durationDays: 7,
      deviceType: 'esim',
    },
  ) {}

  async respond({
    session,
    message,
    args,
  }: {
    session: SessionData;
    message: string;
    args?: Record<string, unknown>;
  }): Promise<ChatReply> {
    const result = await this.invoker.invoke('search_plans', args ?? this.defaultArgs, session);

    return {
      answer: [
        '[stub responder — no model involved]',
        `you said: ${message}`,
        `tenant: ${session.tenantId}`,
        `locale: ${session.locale ?? '(tenant default)'}`,
        `auth: ${session.auth}`,
        `search_plans returned: ${JSON.stringify(result)}`,
      ].join('\n'),
    };
  }
}
