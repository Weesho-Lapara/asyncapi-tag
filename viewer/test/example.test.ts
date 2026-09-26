import { describe, expect, it } from 'vitest';
import { parseText } from '../src/load/loader.js';
import { RefResolver } from '../src/load/refs.js';
import { normalize } from '../src/model/normalize.js';
import type { SchemaNode } from '../src/model/types.js';
import { generateExample } from '../src/util/example.js';
import ordersYaml from '../../docs/examples/orders-v3.yaml?raw';
import compositionYaml from './fixtures/docs/composition.yaml?raw';

function node(partial: Partial<SchemaNode> & { name: string }): SchemaNode {
  return { kind: 'node', path: [], types: [], required: false, constraints: [], children: [], ...partial };
}

async function schemaOf(text: string, id: string): Promise<SchemaNode> {
  const parsed = parseText(text);
  if ('error' in parsed) throw new Error(parsed.error.message);
  const resolver = new RefResolver('https://docs.test/a.yaml', parsed.data);
  await resolver.preload();
  const doc = normalize({ resolver, data: parsed.data, specVersion: '3.0.0', specMajor: 3 });
  const s = doc.schemas.find((x) => x.id === id)?.schema;
  if (s?.kind !== 'node') throw new Error('not a node');
  return s;
}

describe('generated examples', () => {
  it('prefers examples, default, const and enum over generation', () => {
    expect(generateExample(node({ name: 'a', types: ['string'], examples: ['from-examples'], default: 'd' }))).toBe('from-examples');
    expect(generateExample(node({ name: 'a', types: ['integer'], default: 7 }))).toBe(7);
    expect(generateExample(node({ name: 'a', const: 'fixed' }))).toBe('fixed');
    expect(generateExample(node({ name: 'carrier', types: ['string'], enum: ['dhl', 'ups'] }))).toBe('dhl');
  });

  it('uses formats, bounds and field names, never a bare placeholder when a hint exists', () => {
    expect(generateExample(node({ name: 'x', types: ['string'], format: 'uuid' }))).toMatch(/^[0-9a-f-]{36}$/);
    expect(generateExample(node({ name: 'x', types: ['string'], format: 'email' }))).toContain('@');
    expect(generateExample(node({ name: 'createdAt', types: ['string'], format: 'date-time' }))).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(generateExample(node({ name: 'orderId', types: ['string'] }))).toBe('ord_01HZ3');
    expect(generateExample(node({ name: 'customerId', types: ['string'] }))).toBe('cus_01HZ3');
    expect(generateExample(node({ name: 'email', types: ['string'] }))).toBe('ada@example.com');
    expect(generateExample(node({ name: 'quantity', types: ['integer'], constraints: [{ key: 'minimum', value: 5 }] }))).toBe(5);
    expect(generateExample(node({ name: 'unitPrice', types: ['number'], constraints: [{ key: 'minimum', value: 0 }] }))).toBe(12.5);
    expect(generateExample(node({ name: 'ok', types: ['boolean'] }))).toBe(true);
    expect(generateExample(node({ name: 'code', types: ['string'], constraints: [{ key: 'maxLength', value: 3 }] }))).toBe('MUG');
    expect(generateExample(node({ name: 'pin', types: ['string'], constraints: [{ key: 'minLength', value: 12 }] }))).toHaveLength(12);
    expect(generateExample(node({ name: 'misc', types: ['string'] }))).toBe('misc-example');
  });

  it('builds nested objects and arrays from real schemas', async () => {
    const order = await schemaOf(ordersYaml, 'Order');
    expect(generateExample(order)).toEqual({
      orderId: 'ord_01HZ3',
      customerId: 'cus_01HZ3',
      items: [{ sku: 'MUG-TEAL-01', quantity: 2, unitPrice: 12.5 }],
      total: 12.5,
    });
  });

  it('picks the first variant of a composition and handles map-like objects, tuples and circular leaves', async () => {
    const shape = await schemaOf(compositionYaml, 'Shape');
    expect(generateExample(shape)).toEqual({ radius: 3.14 });
    const contact = await schemaOf(compositionYaml, 'Contact');
    const out = generateExample(contact) as Record<string, unknown>;
    expect(out['channel']).toBe('ada@example.com');
    expect(out['tags']).toEqual(['example', 42]);
    expect(out['labels']).toEqual({ key: 'example' });
    expect(out['nullable']).toBe('nullable-example');
    expect(out['deprecatedField']).toBe('fixed');
    expect(generateExample(node({ name: 'parent', types: ['object'], circularRef: 'Node' }))).toBeNull();
    expect(generateExample({ kind: 'raw', schemaFormat: 'avro', source: '{}' })).toBeUndefined();
  });
});
