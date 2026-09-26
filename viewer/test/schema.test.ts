import { describe, expect, it } from 'vitest';
import { parseText } from '../src/load/loader.js';
import { RefResolver } from '../src/load/refs.js';
import { checkDocument } from '../src/model/invariants.js';
import { normalize } from '../src/model/normalize.js';
import type { Document, SchemaNode } from '../src/model/types.js';
import avroV2Yaml from './fixtures/docs/avro-v2.yaml?raw';
import avroV3Yaml from './fixtures/docs/avro-v3.yaml?raw';
import circularYaml from './fixtures/docs/circular.yaml?raw';
import compositionYaml from './fixtures/docs/composition.yaml?raw';
import nestedSixYaml from './fixtures/docs/nested-six.yaml?raw';

async function load(text: string): Promise<Document> {
  const parsed = parseText(text);
  if ('error' in parsed) throw new Error(parsed.error.message);
  const specVersion = String(parsed.data['asyncapi']);
  const resolver = new RefResolver('https://docs.test/api.yaml', parsed.data);
  await resolver.preload();
  return normalize({ resolver, data: parsed.data, specVersion, specMajor: specVersion.startsWith('2') ? 2 : 3 });
}

function schema(doc: Document, id: string): SchemaNode {
  const s = doc.schemas.find((x) => x.id === id)?.schema;
  if (s?.kind !== 'node') throw new Error(`schema ${id} is not a node`);
  return s;
}

function names(node: SchemaNode): string[] {
  return node.children.map((c) => c.name);
}

describe('schema tree builder', () => {
  it('composition fixture satisfies the invariants and matches its snapshot', async () => {
    const doc = await load(compositionYaml);
    expect(checkDocument(doc)).toEqual([]);
    expect(doc.problems).toEqual([]);
    expect(doc).toMatchSnapshot();
  });

  it('allOf merges parts in order: union of required, later parts override, nested allOf flattened', async () => {
    const pet = schema(await load(compositionYaml), 'Pet');
    expect(pet.types).toEqual(['object']);
    expect(pet.description).toBe('Common fields');
    expect(names(pet)).toEqual(['id', 'createdAt', 'name', 'nickname']);
    const byName = Object.fromEntries(pet.children.map((c) => [c.name, c]));
    expect(byName['id']).toMatchObject({ required: true, types: ['string'], format: 'uuid' });
    expect(byName['name']).toMatchObject({ required: true, constraints: [{ key: 'minLength', value: 1 }] });
    expect(byName['createdAt']).toMatchObject({ required: false, description: 'Overrides the Base description' });
    expect(byName['createdAt']?.format).toBeUndefined();
    expect(byName['nickname']).toMatchObject({ required: false, types: ['string'] });
    expect(pet.composition).toBeUndefined();
  });

  it('oneOf keeps variants at the parent level, titled by title, ref name or Variant N', async () => {
    const shape = schema(await load(compositionYaml), 'Shape');
    expect(shape.description).toBe('One of several shapes');
    expect(shape.children).toEqual([]);
    expect(shape.composition?.kind).toBe('oneOf');
    expect(shape.composition?.variants.map((v) => v.title)).toEqual(['Circle', 'Square', 'Variant 3']);
    const circle = shape.composition!.variants[0]!.node;
    expect(circle).toMatchObject({ name: 'Shape', path: [], required: false, title: 'Circle' });
    expect(circle.children[0]).toMatchObject({ name: 'radius', path: [], required: true, constraints: [{ key: 'exclusiveMinimum', value: 0 }] });
    expect(shape.composition!.variants[1]!.node.refName).toBe('Square');
  });

  it('anyOf on a property, tuples, map-like objects, unions, booleans and inferred types', async () => {
    const contact = schema(await load(compositionYaml), 'Contact');
    const byName = Object.fromEntries(contact.children.map((c) => [c.name, c]));
    const channel = byName['channel']!;
    expect(channel.composition?.kind).toBe('anyOf');
    expect(channel.composition?.variants.map((v) => [v.title, v.node.name, v.node.path])).toEqual([
      ['Variant 1', 'channel', []],
      ['Variant 2', 'channel', []],
    ]);
    expect(channel.composition?.variants[1]?.node.constraints).toEqual([{ key: 'pattern', value: '^\\+[0-9]+$' }]);
    expect(names(byName['tags']!)).toEqual(['[0]', '[1]']);
    expect(byName['tags']!.children[1]!.path).toEqual(['tags']);
    expect(names(byName['labels']!)).toEqual(['*']);
    expect(byName['labels']!.children[0]).toMatchObject({ types: ['string'], constraints: [{ key: 'maxLength', value: 20 }], path: ['labels'] });
    expect(names(byName['meta']!)).toEqual(['/^x-/']);
    expect(byName['nullable']!.types).toEqual(['string', 'null']);
    expect(byName['anything']!.types).toEqual([]);
    expect(byName['nothing']!.types).toEqual(['never']);
    expect(byName['untypedList']).toMatchObject({ types: ['array'] });
    expect(names(byName['untypedList']!)).toEqual(['[]']);
    expect(byName['deprecatedField']).toMatchObject({ deprecated: true, readOnly: true, const: 'fixed' });
  });

  it('circular references become leaves; a $ref chain cycle is a problem', async () => {
    const doc = await load(circularYaml);
    expect(checkDocument(doc)).toEqual([]);
    const node = schema(doc, 'Node');
    const byName = Object.fromEntries(node.children.map((c) => [c.name, c]));
    expect(byName['parent']).toMatchObject({ circularRef: 'Node', refName: 'Node', types: ['object'], children: [] });
    const items = byName['children']!.children[0]!;
    expect(items).toMatchObject({ name: '[]', circularRef: 'Node', path: ['children'] });
    // Alias resolves to Node and, at the top level, is not circular: it renders the full tree.
    const alias = schema(doc, 'Alias');
    expect(alias.circularRef).toBeUndefined();
    expect(alias.refName).toBe('Node');
    expect(names(alias)).toEqual(['name', 'children', 'parent']);
    expect(doc.schemas.map((s) => s.id)).toEqual(['Node', 'Alias']);
    expect(doc.problems.map((p) => [p.where, p.message])).toEqual([
      // A -> B -> A: the chain is caught when B comes round again, and vice versa.
      ['/components/schemas/A', 'Circular $ref chain at "https://docs.test/api.yaml#/components/schemas/B".'],
      ['/components/schemas/B', 'Circular $ref chain at "https://docs.test/api.yaml#/components/schemas/A".'],
    ]);
  });

  it('six levels: paths accumulate with the items[] segment', async () => {
    const doc = await load(nestedSixYaml);
    expect(checkDocument(doc)).toEqual([]);
    const order = schema(doc, 'Order');
    const items = order.children[0]!;
    const item = items.children[0]!;
    const customisation = item.children[0]!;
    const engraving = customisation.children[0]!;
    const font = engraving.children[1]!;
    const size = font.children[1]!;
    expect([items, item, customisation, engraving, font, size].map((n) => n.name)).toEqual(['items', '[]', 'customisation', 'engraving', 'font', 'size']);
    expect(size.path).toEqual(['items[]', 'customisation', 'engraving', 'font']);
    expect(size.constraints).toEqual([{ key: 'minimum', value: 6 }, { key: 'maximum', value: 72 }]);
    expect(customisation.required).toBe(true);
    expect(engraving.children[0]).toMatchObject({ name: 'text', constraints: [{ key: 'maxLength', value: 40 }] });
  });

  it('a root-level array: the item node is "[]" and its children carry a bare "[]" segment', async () => {
    const doc = await load(`asyncapi: 3.0.0
info: {title: Root array, version: 1.0.0}
channels: {}
operations: {}
components:
  schemas:
    Events:
      type: array
      items:
        type: object
        properties:
          price:
            type: number
`);
    expect(checkDocument(doc)).toEqual([]);
    const events = schema(doc, 'Events');
    expect(events.children[0]).toMatchObject({ name: '[]', path: [] });
    expect(events.children[0]!.children[0]).toMatchObject({ name: 'price', path: ['[]'] });
  });

  it('Avro and Protobuf payloads are raw blocks; JSON Schema multi-format is a tree (v3)', async () => {
    const doc = await load(avroV3Yaml);
    expect(checkDocument(doc)).toEqual([]);
    const [avro, proto, plain] = doc.messages;
    expect(avro?.schemaFormat).toBe('application/vnd.apache.avro;version=1.9.0');
    expect(avro?.payload).toEqual({
      kind: 'raw',
      schemaFormat: 'application/vnd.apache.avro;version=1.9.0',
      source: JSON.stringify({ type: 'record', name: 'UserEvent', fields: [{ name: 'id', type: 'string' }, { name: 'age', type: [null, 'int'] }] }, null, 2),
    });
    expect(proto?.payload).toEqual({
      kind: 'raw',
      schemaFormat: 'application/vnd.google.protobuf;version=3',
      source: 'syntax = "proto3";\nmessage Proto { string id = 1; }\n',
    });
    expect(plain?.schemaFormat).toBe('application/schema+json;version=draft-07');
    expect(plain?.payload).toMatchObject({ kind: 'node', children: [{ name: 'ok', types: ['boolean'] }] });
  });

  it('a v2 message-level Avro schemaFormat makes the payload raw while headers stay a tree', async () => {
    const doc = await load(avroV2Yaml);
    expect(checkDocument(doc)).toEqual([]);
    const m = doc.messages[0]!;
    expect(m.schemaFormat).toBe('application/vnd.apache.avro;version=1.9.0');
    expect(m.payload?.kind).toBe('raw');
    expect(m.headers).toMatchObject({ kind: 'node', children: [{ name: 'traceId' }] });
  });
});
