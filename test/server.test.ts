/**
 * Tests the server layer's create_order handler.
 *
 * create_order is blocked in two independent places: `hiddenFromChat` keeps it off
 * the chat model's menu entirely, and the handler itself throws NotImplementedError
 * for any MCP client that calls it. This test exercises the MCP path via the
 * in-process transport.
 *
 * (Previously server.ts carried an inline hardcoded response as a second guard.
 * That is now redundant — the tool registry is the single source of truth for both
 * entry points — so the message comes from NotImplementedError instead.)
 */
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/server.js';

async function makeConnectedClient() {
  const mcpServer = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await mcpServer.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);

  return { client, mcpServer };
}

describe('server layer — create_order', () => {
  it('returns ok:false with phase-1 message and isError:true', async () => {
    const { client, mcpServer } = await makeConnectedClient();

    const result = await client.callTool({
      name: 'create_order',
      arguments: {
        planCode: 'P001',
        userId: 'U1',
        travelDetails: [{ startDate: '2026-06-01', endDate: '2026-06-10', countryCode: 'SG' }],
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.ok).toBe(false);
    expect(payload.message).toBe('Order creation is not available in this phase');

    await mcpServer.close();
  });

  it('tools list includes create_order', async () => {
    const { client, mcpServer } = await makeConnectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('create_order');
    await mcpServer.close();
  });
});
