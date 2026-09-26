import { describe, expect, it } from 'vitest';
import { avroToNode } from '../src/model/avro.js';
import { checkDocument } from '../src/model/invariants.js';
import type { Document } from '../src/model/types.js';

const costing = {
  type: 'record',
  name: 'CostingRequestPayload',
  namespace: 'com.adeo',
  fields: [
    { name: 'ProductId', type: 'string', doc: 'Product identifier.' },
    { name: 'ShortProductDescription', type: ['null', 'string'], doc: 'A short product description.', default: null },
    { name: 'SupplierPrice', type: 'float' },
    { name: 'Unit', type: { type: 'record', name: 'UnitItem', fields: [{ name: 'Length', type: 'float' }, { name: 'WeightNet', type: 'float', doc: 'kilograms' }] } },
    {
      name: 'BusInputs',
      type: {
        type: 'array',
        doc: 'Business units',
        items: {
          type: 'record',
          name: 'BUItem',
          fields: [
            { name: 'ClientCode', type: 'string' },
            { name: 'ContainerType', type: ['null', { type: 'enum', name: 'ContainerTypeItems', symbols: ['FT20', 'FT40'] }] },
            { name: 'Unit', type: 'UnitItem' },
            { name: 'Parent', type: ['null', 'BUItem'] },
            { name: 'When', type: { type: 'long', logicalType: 'timestamp-millis' } },
            { name: 'Attrs', type: { type: 'map', values: 'string' } },
            { name: 'Amount', type: ['int', 'string'], default: 1 },
            { name: 'Hash', type: { type: 'fixed', name: 'Md5', size: 16 } },
          ],
        },
      },
    },
  ],
};

describe('Avro to tree', () => {
  const root = avroToNode(costing, '', true)!;
  const byName = (n = root) => Object.fromEntries(n.children.map((c) => [c.name, c]));

  it('records become objects with fields, docs and required flags', () => {
    expect(root).toMatchObject({ kind: 'node', types: ['object'], title: 'CostingRequestPayload', required: false, path: [] });
    const f = byName();
    expect(f['ProductId']).toMatchObject({ types: ['string'], required: true, description: 'Product identifier.' });
    expect(f['ShortProductDescription']).toMatchObject({ types: ['string', 'null'], required: false });
    expect(f['SupplierPrice']).toMatchObject({ types: ['number'], required: true });
    expect(f['Unit']).toMatchObject({ types: ['object'], title: 'UnitItem' });
    expect(byName(f['Unit']!)['WeightNet']).toMatchObject({ description: 'kilograms', path: ['Unit'] });
  });

  it('arrays, named references, circular references, enums, logical types, maps, unions and fixed', () => {
    const bus = byName()['BusInputs']!;
    expect(bus).toMatchObject({ types: ['array'], description: 'Business units' });
    const item = bus.children[0]!;
    expect(item).toMatchObject({ name: '[]', types: ['object'], title: 'BUItem', path: ['BusInputs'] });
    const f = byName(item);
    expect(f['ClientCode']!.path).toEqual(['BusInputs[]']);
    expect(f['ContainerType']).toMatchObject({ types: ['string', 'null'], enum: ['FT20', 'FT40'], required: false, title: 'ContainerTypeItems' });
    expect(f['Unit']).toMatchObject({ types: ['object'], refName: 'UnitItem' });
    expect(f['Unit']!.children.map((c) => c.name)).toEqual(['Length', 'WeightNet']);
    expect(f['Parent']).toMatchObject({ circularRef: 'BUItem', types: ['object', 'null'], required: false, children: [] });
    expect(f['When']).toMatchObject({ types: ['integer'], format: 'date-time' });
    expect(f['Attrs']).toMatchObject({ types: ['object'] });
    expect(f['Attrs']!.children[0]).toMatchObject({ name: '*', types: ['string'] });
    expect(f['Amount']!.composition?.kind).toBe('oneOf');
    expect(f['Amount']!.composition?.variants.map((v) => [v.title, v.node.types])).toEqual([['int', ['integer']], ['string', ['string']]]);
    expect(f['Amount']!.default).toBe(1);
    expect(f['Hash']).toMatchObject({ types: ['string'], format: 'bytes', constraints: [{ key: 'maxLength', value: 16 }] });
  });

  it('satisfies the model invariants inside a document', () => {
    const doc: Document = {
      specVersion: '3.0.0', specMajor: 3, title: 't', version: '1', tags: [], servers: [], operations: [], schemas: [], problems: [],
      messages: [{ id: 'm', anchor: 'm', contentType: 'avro/binary', schemaFormat: 'application/vnd.apache.avro;version=1.9.0', payload: root, examples: [], tags: [], bindings: [] }],
    };
    expect(checkDocument(doc)).toEqual([]);
  });

  it('rejects things that are not Avro', () => {
    expect(avroToNode(42, '', true)).toBeUndefined();
    expect(avroToNode({ properties: {} }, '', true)).toBeUndefined();
    expect(avroToNode('string', '', true)).toMatchObject({ types: ['string'] });
  });
});
