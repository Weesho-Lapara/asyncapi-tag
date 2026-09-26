import { describe, expect, it } from 'vitest';
import { parseText } from '../src/load/loader.js';
import { RefResolver } from '../src/load/refs.js';
import { checkDocument } from '../src/model/invariants.js';
import { normalize } from '../src/model/normalize.js';
import type { Document } from '../src/model/types.js';
import traitsV2Yaml from './fixtures/docs/traits-v2.yaml?raw';
import traitsV3Yaml from './fixtures/docs/traits-v3.yaml?raw';

async function load(text: string, applyTraits = true): Promise<Document> {
  const parsed = parseText(text);
  if ('error' in parsed) throw new Error(parsed.error.message);
  const specVersion = String(parsed.data['asyncapi']);
  const resolver = new RefResolver('https://docs.test/api.yaml', parsed.data);
  await resolver.preload();
  return normalize({ resolver, data: parsed.data, specVersion, specMajor: specVersion.startsWith('2') ? 2 : 3, options: { applyTraits } });
}

describe('traits (v3)', () => {
  it('operation fields win, then earlier traits over later; forbidden keys are dropped with a problem', async () => {
    const doc = await load(traitsV3Yaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc).toMatchSnapshot();
    const op = doc.operations[0]!;
    expect(op.summary).toBe("The operation's own summary wins");
    expect(op.description).toBe('From the first trait');
    expect(op.action).toBe('send');
    expect(op.tags.map((t) => t.name)).toEqual(['from-first-trait']);
    expect(op.bindings).toEqual([
      { scope: 'operation', protocol: 'kafka', key: 'clientId', value: 'second' },
      { scope: 'operation', protocol: 'kafka', key: 'groupId', value: 'orders-api' },
      { scope: 'operation', protocol: 'kafka', key: 'bindingVersion', value: '0.5.0' },
    ]);
    expect(op.security).toEqual([{ id: 'sasl', type: 'scramSha256', description: 'SASL/SCRAM', scopes: [] }]);

    const order = doc.messages[0]!;
    expect(order.contentType).toBe('application/avro');
    expect(order.correlationId).toEqual({ location: '$message.header#/traceId' });
    expect(order.headers).toMatchObject({ kind: 'node', children: [{ name: 'traceId' }] });
    expect(order.payload).toMatchObject({ kind: 'node', children: [{ name: 'id' }] });
    expect(order.bindings).toEqual([{ scope: 'message', protocol: 'kafka', key: 'key', value: { type: 'string' } }]);

    expect(doc.servers[0]?.bindings).toEqual([
      { scope: 'server', protocol: 'kafka', key: 'schemaRegistryUrl', value: 'https://registry.example.com' },
      { scope: 'server', protocol: 'kafka', key: 'bindingVersion', value: '0.5.0' },
    ]);
    expect(op.channel.bindings).toEqual([{ scope: 'channel', protocol: 'kafka', key: 'partitions', value: 12 }]);

    expect(doc.problems).toEqual([
      // The message is built when its channel is read, before the operations.
      { severity: 'warning', message: 'A trait must not define "payload"; that field of the trait at "/components/messages/Order/traits/0" was ignored.', where: '/components/messages/Order/traits/0' },
      { severity: 'warning', message: 'A trait must not define "action"; that field of the trait at "/operations/emitOrder/traits/1" was ignored.', where: '/operations/emitOrder/traits/1' },
      { severity: 'warning', message: 'Operation "onNothing" uses channel "empty", which defines no messages.', where: '/operations/onNothing/channel' },
    ]);
  });

  it('applyTraits=false leaves traits alone', async () => {
    const doc = await load(traitsV3Yaml, false);
    const op = doc.operations[0]!;
    expect(op.description).toBeUndefined();
    expect(op.bindings).toEqual([]);
    expect(op.tags).toEqual([]);
    expect(doc.messages[0]?.contentType).toBe('application/json');
    expect(doc.messages[0]?.headers).toBeUndefined();
    expect(doc.problems.map((p) => p.where)).toEqual(['/operations/onNothing/channel']);
  });
});

describe('traits (v2)', () => {
  it('operation and message traits apply; a trait may not smuggle a message; empty channels warn', async () => {
    const doc = await load(traitsV2Yaml);
    expect(checkDocument(doc)).toEqual([]);
    const op = doc.operations[0]!;
    expect(op.summary).toBe('From the trait');
    expect(op.bindings).toEqual([{ scope: 'operation', protocol: 'mqtt', key: 'qos', value: 1 }]);
    expect(op.messages[0]?.id).toBe('Order');
    expect(op.messages[0]?.contentType).toBe('text/plain');
    expect(op.messages[0]?.headers).toMatchObject({ kind: 'node', children: [{ name: 'traceId' }] });
    expect(doc.problems).toEqual([
      { severity: 'warning', message: 'A trait must not define "message"; that field of the trait at "/channels/orders/subscribe/traits/1" was ignored.', where: '/channels/orders/subscribe/traits/1' },
      { severity: 'warning', message: 'Channel "quiet" has neither publish nor subscribe, so nothing is shown for it.', where: '/channels/quiet' },
    ]);
  });
});
