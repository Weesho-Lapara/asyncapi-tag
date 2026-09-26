import { describe, expect, it } from 'vitest';
import accountsJson from '../../docs/examples/accounts-v2.json?raw';
import { parseText } from '../src/load/loader.js';
import { RefResolver } from '../src/load/refs.js';
import { checkDocument } from '../src/model/invariants.js';
import { normalize } from '../src/model/normalize.js';
import type { Document } from '../src/model/types.js';
import oneOfYaml from './fixtures/docs/oneof-v2.yaml?raw';
import parametersYaml from './fixtures/docs/parameters-v2.yaml?raw';
import { accountsV2 } from './fixtures/expected/accounts-v2.js';

async function load(text: string, url = 'https://docs.test/api.yaml'): Promise<Document> {
  const parsed = parseText(text);
  if ('error' in parsed) throw new Error(parsed.error.message);
  const resolver = new RefResolver(url, parsed.data, async () => ({ ok: false, status: 404, text: async () => '' }));
  const problems = await resolver.preload();
  return normalize({ resolver, data: parsed.data, specVersion: String(parsed.data['asyncapi']), specMajor: 2, problems });
}

describe('v2 normaliser', () => {
  it('reproduces the hand-written accounts-v2 model exactly', async () => {
    const doc = await load(accountsJson);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc).toEqual(accountsV2);
    expect(doc.operations[1]?.messages[0]).toBe(doc.messages[1]);
  });

  it('parameters with schema, server lists, security requirements, license and external docs', async () => {
    const doc = await load(parametersYaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc).toMatchSnapshot();

    const [post, listen] = doc.operations;
    expect(post).toMatchObject({ id: 'postMessage', action: 'receive', kind: 'receive', badgeLabel: 'PUB', locationHint: 'channels › rooms/{roomId}/messages/{kind} › publish' });
    expect(post?.anchor).toBe('postMessage');
    expect(listen).toMatchObject({ id: 'subscribe-rooms/{roomId}/messages/{kind}', heading: 'subscribe rooms/{roomId}/messages/{kind}', action: 'send', badgeLabel: 'SUB' });
    expect(listen?.anchor).toBe('subscribe-rooms-roomId-messages-kind');
    expect(post?.channel.parameters).toEqual([
      { name: 'roomId', description: 'Room identifier', location: '$message.payload#/roomId', schemaType: 'string' },
      { name: 'kind', description: 'Message kind', schemaType: 'string', enum: ['text', 'image'], default: 'text' },
    ]);
    expect(post?.channel.servers).toEqual(['prod']);
    expect(post?.channel.bindings).toEqual([{ scope: 'channel', protocol: 'ws', key: 'method', value: 'GET' }]);
    expect(post?.security).toEqual([{ id: 'apiKey', type: 'httpApiKey', description: 'Tenant API key', scopes: [] }]);
    expect(doc.servers[0]?.security).toEqual([
      { id: 'apiKey', type: 'httpApiKey', description: 'Tenant API key', scopes: [] },
      { id: 'oauth', type: 'oauth2', scopes: ['read', 'write'] },
      { id: 'ghost', type: '', scopes: [] },
    ]);
    expect(doc.servers[0]).toMatchObject({ hostDisplay: 'wss://rooms.example.com/{tenant}', protocolVersion: '13' });
    expect(doc.servers[0]?.variables).toEqual([{ name: 'tenant', default: 'acme', examples: ['acme', 'globex'] }]);
    expect(doc.license).toEqual({ name: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' });
    expect(doc.externalDocs).toEqual({ url: 'https://example.com/rooms' });
    // Inline message: id from its name; component message reused with its own schemaFormat.
    expect(post?.messages[0]).toMatchObject({ id: 'ChatMessage', anchor: 'rooms-roomId-messages-kind-publish' });
    expect(listen?.messages[0]).toBe(doc.messages[0]);
    expect(doc.messages[0]?.schemaFormat).toBe('application/schema+json;version=draft-07');
    expect(doc.problems).toEqual([
      { severity: 'warning', message: 'Security scheme "ghost" is not defined in components.securitySchemes.', where: '/servers/prod/security/2' },
      { severity: 'warning', message: 'Channel "rooms/{roomId}/messages/{kind}" lists server "nope" which is not in "servers"; it was ignored.', where: '/channels/rooms~1{roomId}~1messages~1{kind}/servers/1' },
    ]);
  });

  it('message oneOf, synthesised ids, and union parameter types', async () => {
    const doc = await load(oneOfYaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc).toMatchSnapshot();
    expect(doc.problems).toEqual([]);
    const [alerts, ack, audit] = doc.operations;
    expect(alerts).toMatchObject({ id: 'publish-alerts', heading: 'publish alerts', badgeLabel: 'PUB' });
    expect(alerts?.messages.map((m) => m.id)).toEqual(['Warning', 'Critical', 'Warning']);
    expect(alerts?.messages[0]).toBe(doc.messages[0]);
    expect(alerts?.messages[2]).toBe(doc.messages[0]);
    expect(alerts?.messages[1]?.anchor).toBe('alerts-publish-1');
    expect(ack?.id).toBe('acknowledge');
    expect(audit?.channel.parameters).toEqual([{ name: 'id', schemaType: 'string | null' }]);
    expect(audit?.messages[0]).toMatchObject({ id: 'audit/{id}-subscribe', anchor: 'audit-id-subscribe' });
    expect(audit?.messages[0]?.payload).toMatchObject({ kind: 'node', types: ['string'], children: [] });
  });

  it('honours the publish and subscribe labels', async () => {
    const parsed = parseText(accountsJson);
    if ('error' in parsed) throw new Error(parsed.error.message);
    const resolver = new RefResolver('https://x.test/a.json', parsed.data);
    const doc = normalize({ resolver, data: parsed.data, specVersion: '2.6.0', specMajor: 2, options: { labels: { publish: 'IN', subscribe: 'OUT' } as never } });
    expect(doc.operations.map((o) => o.badgeLabel)).toEqual(['OUT', 'IN']);
  });
});
