import { describe, expect, it } from 'vitest';
import ordersYaml from '../../docs/examples/orders-v3.yaml?raw';
import { parseText } from '../src/load/loader.js';
import { RefResolver } from '../src/load/refs.js';
import { checkDocument } from '../src/model/invariants.js';
import { normalize } from '../src/model/normalize.js';
import type { Document } from '../src/model/types.js';
import multiMessageYaml from './fixtures/docs/multi-message.yaml?raw';
import requestReplyYaml from './fixtures/docs/request-reply.yaml?raw';
import { ordersV3 } from './fixtures/expected/orders-v3.js';

async function load(text: string, url = 'https://docs.test/api.yaml'): Promise<Document> {
  const parsed = parseText(text);
  if ('error' in parsed) throw new Error(parsed.error.message);
  const resolver = new RefResolver(url, parsed.data, async () => ({ ok: false, status: 404, text: async () => '' }));
  const problems = await resolver.preload();
  return normalize({ resolver, data: parsed.data, specVersion: String(parsed.data['asyncapi']), specMajor: 3, problems });
}

describe('v3 normaliser', () => {
  it('reproduces the hand-written orders-v3 model exactly', async () => {
    const doc = await load(ordersYaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc).toEqual(ordersV3);
    // Identity, not just equality: the operation carries the component message object.
    expect(doc.operations[0]?.messages[0]).toBe(doc.messages[0]);
  });

  it('request/reply: kinds, labels, reply channel and address, parameters, security, bindings, examples', async () => {
    const doc = await load(requestReplyYaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc.problems).toEqual([]);
    expect(doc).toMatchSnapshot();

    const [request, reply] = doc.operations;
    expect(request).toMatchObject({ kind: 'request', action: 'send', badgeLabel: 'REQUEST', heading: 'Request a quote', locationHint: 'requestQuote' });
    expect(request?.reply).toMatchObject({ addressLocation: '$message.header#/replyTo', addressDescription: 'Where the reply goes' });
    expect(request?.reply?.channel?.id).toBe('quoteReplies');
    expect(request?.reply?.channel?.address).toBeNull();
    // No reply.messages listed: all messages of the reply channel.
    expect(request?.reply?.messages.map((m) => m.id)).toEqual(['QuoteReply', 'QuoteRejected']);
    expect(reply).toMatchObject({ kind: 'reply', action: 'receive', badgeLabel: 'REPLY', heading: 'answerQuote' });
    expect(reply?.reply?.messages.map((m) => m.id)).toEqual(['QuoteRequest']);

    expect(request?.channel.parameters).toEqual([{ name: 'customerId', description: 'The customer asking', examples: ['cus_1'] }]);
    expect(request?.channel.servers).toEqual(['main']);
    expect(request?.bindings).toEqual([
      { scope: 'operation', protocol: 'amqp', key: 'expiration', value: 100000 },
      { scope: 'operation', protocol: 'amqp', key: 'ack', value: false },
    ]);
    expect(doc.servers[0]).toMatchObject({ hostDisplay: 'mq.example.com/v1', protocolVersion: '0.9.1', title: 'Main broker' });
    expect(doc.servers[0]?.security).toEqual([{ id: 'userPass', type: 'userPassword', description: 'Broker credentials', scopes: [] }]);
    expect(doc.servers[0]?.variables).toEqual([{ name: 'region', description: 'Deployment region', enum: ['eu', 'us'], default: 'eu' }]);
    expect(doc.contact).toEqual({ name: 'Platform team', email: 'platform@example.com' });
    expect(doc.tags).toEqual([{ name: 'quotes', description: 'Quote lifecycle' }]);
    expect(doc.externalDocs).toEqual({ url: 'https://example.com/docs/quotes', description: 'Runbook' });
    expect(doc.defaultContentType).toBe('application/json');

    const quoteRequest = doc.messages[0]!;
    expect(quoteRequest.contentType).toBe('application/json');
    expect(doc.messages[1]?.contentType).toBe('application/xml');
    expect(quoteRequest.correlationId).toEqual({ location: '$message.header#/correlationId', description: 'Echoed in the reply' });
    expect(quoteRequest.examples).toEqual([{ name: 'one', summary: 'A single item', headers: { replyTo: 'quotes/cus_1/reply' }, payload: { productId: 'prd_9' } }]);
    expect(quoteRequest.headers?.kind).toBe('node');
    // An inline channel message is not a component message but still has a stable anchor.
    const rejected = reply?.messages[1];
    expect(rejected).toMatchObject({ id: 'QuoteRejected', anchor: 'quoteReplies-QuoteRejected' });
    expect(doc.messages.map((m) => m.id)).toEqual(['QuoteRequest', 'QuoteReply']);
  });

  it('multi-message: all channel messages by default, a listed subset otherwise; bad operations become problems', async () => {
    const doc = await load(multiMessageYaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc).toMatchSnapshot();
    expect(doc.operations.map((o) => o.id)).toEqual(['sendAll', 'sendSome']);
    expect(doc.operations[0]?.messages.map((m) => m.id)).toEqual(['Email', 'Sms', 'Push']);
    expect(doc.operations[1]?.messages.map((m) => m.id)).toEqual(['Sms', 'Push']);
    expect(doc.operations[0]?.messages[0]).toBe(doc.messages[0]);
    expect(doc.problems).toEqual([
      { severity: 'error', message: 'Could not resolve $ref "#/channels/nope": nothing at "/channels/nope".', where: '/operations/broken/channel' },
      { severity: 'error', message: 'Operation "broken" does not reference a channel in "channels". It was skipped.', where: '/operations/broken/channel' },
      { severity: 'error', message: 'Operation "wrongAction" has action "publish"; expected send or receive. It was skipped.', where: '/operations/wrongAction/action' },
    ]);
  });

  it('honours label options and useChannelAddressAsIdentifier', async () => {
    const parsed = parseText(ordersYaml);
    if ('error' in parsed) throw new Error(parsed.error.message);
    const resolver = new RefResolver('https://x.test/o.yaml', parsed.data);
    const doc = normalize({
      resolver, data: parsed.data, specVersion: '3.0.0', specMajor: 3,
      options: { labels: { send: 'EMIT' } as never, useChannelAddressAsIdentifier: true },
    });
    expect(doc.operations[0]).toMatchObject({ badgeLabel: 'EMIT', heading: 'orders.placed' });
    expect(doc.operations[1]).toMatchObject({ badgeLabel: 'RECEIVE', heading: 'orders.shipped' });
  });
});
