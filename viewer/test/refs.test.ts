import { describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/load/loader.js';
import { parseText } from '../src/load/loader.js';
import { RefResolver, collectRefs, decodePointerSegment, encodePointerSegment, isRef, schemaNameOf, walkPointer } from '../src/load/refs.js';
import circularYaml from './fixtures/docs/circular.yaml?raw';
import externalYaml from './fixtures/docs/external-ref.yaml?raw';
import sharedMessagesYaml from './fixtures/docs/shared/messages.yaml?raw';
import sharedSchemasYaml from './fixtures/docs/shared/schemas.yaml?raw';

const ROOT = 'https://docs.test/api/external-ref.yaml';

function doc(text: string): Record<string, unknown> {
  const p = parseText(text);
  if ('error' in p) throw new Error(p.error.message);
  return p.data;
}

function fakeFetch(files: Record<string, string>, log: string[] = []): FetchLike {
  return async (url) => {
    log.push(url);
    const body = files[url];
    if (body === undefined) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => body };
  };
}

describe('JSON pointers', () => {
  it('decode and encode ~0 and ~1', () => {
    expect(decodePointerSegment('user~1signedup')).toBe('user/signedup');
    expect(decodePointerSegment('a~0b')).toBe('a~b');
    expect(encodePointerSegment('user/signed~up')).toBe('user~1signed~0up');
  });

  it('walk objects and arrays, and report what is missing', () => {
    const d = { channels: { 'user/signedup': { subscribe: { message: { oneOf: [{ name: 'a' }, { name: 'b' }] } } } } };
    expect(walkPointer(d, '/channels/user~1signedup/subscribe/message/oneOf/1/name')).toBe('b');
    expect(walkPointer(d, '')).toBe(d);
    expect(typeof walkPointer(d, '/channels/nope')).toBe('symbol');
    expect(typeof walkPointer(d, '/channels/user~1signedup/subscribe/message/oneOf/7')).toBe('symbol');
  });

  it('collectRefs lists every $ref with the pointer of its holder', () => {
    const refs = collectRefs(doc(externalYaml));
    expect(refs).toContainEqual(['shared/messages.yaml#/OrderPlaced', '/channels/orders/messages/OrderPlaced']);
    expect(refs).toContainEqual(['#/channels/orders', '/operations/emit/channel']);
    expect(refs).toHaveLength(5);
  });

  it('isRef and schemaNameOf', () => {
    expect(isRef({ $ref: '#/x' })).toBe(true);
    expect(isRef({ $ref: 1 })).toBe(false);
    expect(schemaNameOf('https://a.test/d.yaml#/components/schemas/Order')).toBe('Order');
    expect(schemaNameOf('https://a.test/d.yaml#/components/schemas/Order/properties/id')).toBeUndefined();
    expect(schemaNameOf('https://a.test/d.yaml#/components/messages/Order')).toBeUndefined();
  });
});

describe('RefResolver with external documents', () => {
  const files = {
    'https://docs.test/api/shared/messages.yaml': sharedMessagesYaml,
    'https://docs.test/api/shared/schemas.yaml': sharedSchemasYaml,
    'https://schemas.example.com/common.json': '{"definitions": {"Address": {"type": "object"}}}',
  };

  it('preloads each external document once, recursively, and reports the missing one', async () => {
    const log: string[] = [];
    const resolver = new RefResolver(ROOT, doc(externalYaml), fakeFetch(files, log));
    const problems = await resolver.preload();
    expect(log.sort()).toEqual([
      'https://docs.test/api/missing.yaml',
      'https://docs.test/api/shared/messages.yaml',
      'https://docs.test/api/shared/schemas.yaml',
      'https://schemas.example.com/common.json',
    ]);
    expect(problems).toEqual([
      {
        severity: 'error',
        message: 'Could not load "https://docs.test/api/missing.yaml" for $ref "missing.yaml#/Nope": HTTP 404',
        where: '/components/schemas/Broken',
      },
    ]);
    expect([...resolver.documents.keys()]).toHaveLength(4);
  });

  it('resolves internal, relative, nested-relative and absolute references', async () => {
    const resolver = new RefResolver(ROOT, doc(externalYaml), fakeFetch(files));
    await resolver.preload();

    const internal = resolver.resolve('#/channels/orders', ROOT);
    expect('error' in internal ? internal.error : internal.value).toMatchObject({ address: 'orders' });

    const relative = resolver.resolve('shared/messages.yaml#/OrderPlaced', ROOT);
    if ('error' in relative) throw new Error(relative.error);
    expect(relative.value).toMatchObject({ name: 'OrderPlaced' });
    expect(relative.baseUrl).toBe('https://docs.test/api/shared/messages.yaml');
    expect(relative.id).toBe('https://docs.test/api/shared/messages.yaml#/OrderPlaced');

    // A ref inside the external file resolves against that file, not the root.
    const total = walkPointer(relative.value, '/payload/properties/total');
    const money = resolver.deref(total, relative.baseUrl);
    if ('error' in money) throw new Error(money.error);
    expect(money.id).toBe('https://docs.test/api/shared/schemas.yaml#/Money');
    expect(money.value).toMatchObject({ type: 'object' });

    const absolute = resolver.resolve('https://schemas.example.com/common.json#/definitions/Address', ROOT);
    expect('error' in absolute ? absolute.error : absolute.value).toEqual({ type: 'object' });
  });

  it('fails clearly for unloaded documents, bad fragments and missing pointers', async () => {
    const resolver = new RefResolver(ROOT, doc(externalYaml), fakeFetch(files));
    await resolver.preload();
    expect(resolver.resolve('missing.yaml#/Nope', ROOT)).toEqual({ error: 'Could not resolve $ref "missing.yaml#/Nope": HTTP 404.' });
    expect(resolver.resolve('never-mentioned.yaml#/x', ROOT)).toEqual({
      error: 'Could not resolve $ref "never-mentioned.yaml#/x": the document was not loaded.',
    });
    expect(resolver.resolve('#components/schemas/Money', ROOT)).toEqual({
      error: 'Could not resolve $ref "#components/schemas/Money": the fragment is not a JSON pointer.',
    });
    expect(resolver.resolve('#/components/schemas/Nope', ROOT)).toEqual({
      error: 'Could not resolve $ref "#/components/schemas/Nope": nothing at "/components/schemas/Nope".',
    });
  });

  it('a whole-document reference and a percent-encoded fragment work', async () => {
    const resolver = new RefResolver(ROOT, doc(externalYaml), fakeFetch(files));
    await resolver.preload();
    const whole = resolver.resolve('shared/schemas.yaml', ROOT);
    expect('error' in whole ? whole.error : Object.keys(whole.value as object)).toEqual(['Money', 'Currency']);
    const encoded = resolver.resolve('#/channels/orders/messages/OrderPlaced', ROOT);
    const percent = resolver.resolve('#/channels/orders/messages/Order%50laced', ROOT);
    expect(percent).toEqual(encoded);
  });
});

describe('RefResolver with an internal-only document', () => {
  it('needs no fetch and follows reference chains with a cycle guard', async () => {
    const calls: string[] = [];
    const resolver = new RefResolver('file:///circular.yaml#ignored', doc(circularYaml), fakeFetch({}, calls));
    expect(await resolver.preload()).toEqual([]);
    expect(calls).toEqual([]);

    const alias = resolver.deref({ $ref: '#/components/schemas/Alias' }, 'file:///circular.yaml');
    if ('error' in alias) throw new Error(alias.error);
    expect(alias.id).toBe('file:///circular.yaml#/components/schemas/Node');
    expect(schemaNameOf(alias.id!)).toBe('Node');

    expect(resolver.deref({ $ref: '#/components/schemas/A' }, 'file:///circular.yaml')).toEqual({
      error: 'Circular $ref chain at "file:///circular.yaml#/components/schemas/A".',
    });

    // A self-referencing schema is not an error for the resolver: it hands back the same id
    // each time, which is what the tree builder uses to stop.
    const node = resolver.deref({ $ref: '#/components/schemas/Node' }, 'file:///circular.yaml');
    if ('error' in node) throw new Error(node.error);
    const items = walkPointer(node.value, '/properties/children/items');
    const again = resolver.deref(items, node.baseUrl);
    expect('error' in again ? again.error : again.id).toBe(node.id);

    const inline = resolver.deref({ type: 'string' }, 'file:///circular.yaml');
    expect(inline).toEqual({ value: { type: 'string' }, id: undefined, baseUrl: 'file:///circular.yaml', pointer: '' });
  });
});
