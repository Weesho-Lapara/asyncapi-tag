/**
 * Avro schemas as SchemaNode trees, so Kafka documents get the same rows as JSON Schema.
 *
 * Mapping: record -> object (fields as children, `doc` as description, field `default`);
 * a union with `null` marks the field optional and adds "null" to the types; a union of
 * several non-null types becomes oneOf variants; array -> "[]" item; map -> "*" child;
 * enum -> string with enum; fixed and bytes -> string · bytes; logical types become formats.
 * Named types are registered when first seen so later references by name resolve; a
 * reference back to an ancestor becomes a circular leaf.
 */
import type { SchemaNode } from './types.js';

type Avro = string | AvroObject | Avro[];
interface AvroObject {
  type: Avro;
  name?: string;
  namespace?: string;
  doc?: string;
  fields?: Array<{ name: string; type: Avro; doc?: string; default?: unknown }>;
  items?: Avro;
  values?: Avro;
  symbols?: string[];
  logicalType?: string;
  size?: number;
}

const PRIMITIVES: Record<string, string> = {
  null: 'null',
  boolean: 'boolean',
  int: 'integer',
  long: 'integer',
  float: 'number',
  double: 'number',
  bytes: 'string',
  string: 'string',
};

const LOGICAL_FORMATS: Record<string, string> = {
  'timestamp-millis': 'date-time',
  'timestamp-micros': 'date-time',
  'local-timestamp-millis': 'date-time',
  'local-timestamp-micros': 'date-time',
  date: 'date',
  'time-millis': 'time',
  'time-micros': 'time',
  uuid: 'uuid',
  decimal: 'decimal',
  duration: 'duration',
};

export function isAvroFormat(schemaFormat: string): boolean {
  return schemaFormat.toLowerCase().includes('avro');
}

/** Build a tree from an Avro schema; undefined when the value is not an Avro schema at all. */
export function avroToNode(schema: unknown, name: string, isRoot: boolean): SchemaNode | undefined {
  if (!isAvro(schema)) return undefined;
  const registry = new Map<string, AvroObject>();
  return build(schema, { name, path: [], required: false, isRoot, ancestors: new Set(), registry });
}

function isAvro(value: unknown): value is Avro {
  return typeof value === 'string' || Array.isArray(value) || (typeof value === 'object' && value !== null && 'type' in value);
}

interface Input {
  name: string;
  path: string[];
  required: boolean;
  isRoot: boolean;
  ancestors: Set<string>;
  registry: Map<string, AvroObject>;
}

function fullName(o: AvroObject, ns?: string): string | undefined {
  if (!o.name) return undefined;
  if (o.name.includes('.')) return o.name;
  const namespace = o.namespace ?? ns;
  return namespace ? `${namespace}.${o.name}` : o.name;
}

function build(schema: Avro, input: Input, ns?: string): SchemaNode {
  const node: SchemaNode = { kind: 'node', name: input.name, path: input.path, types: [], required: input.required, constraints: [], children: [] };
  const childPath = input.isRoot ? [] : input.name === '[]' ? [...input.path.slice(0, -1), `${input.path[input.path.length - 1] ?? ''}[]`] : [...input.path, input.name];

  // Unions: null makes the field nullable; several real types become variants.
  if (Array.isArray(schema)) {
    const members = schema.filter((m) => m !== 'null');
    const nullable = members.length !== schema.length;
    if (members.length === 1) {
      const inner = build(members[0]!, input, ns);
      if (nullable && !inner.types.includes('null')) inner.types = [...inner.types, 'null'];
      return inner;
    }
    node.types = nullable ? ['null'] : [];
    node.composition = {
      kind: 'oneOf',
      variants: members.map((m, i) => ({ title: variantTitle(m, i), node: build(m, input, ns) })),
    };
    return node;
  }

  // Primitive or named reference.
  if (typeof schema === 'string') {
    const primitive = PRIMITIVES[schema];
    if (primitive !== undefined) {
      node.types = [primitive];
      if (schema === 'bytes') node.format = 'bytes';
      return node;
    }
    const ref = input.registry.get(schema) ?? input.registry.get(ns ? `${ns}.${schema}` : schema);
    if (ref) {
      const id = fullName(ref, ns) ?? schema;
      if (input.ancestors.has(id)) {
        node.types = [ref.type === 'record' ? 'object' : 'string'];
        node.circularRef = ref.name ?? schema;
        node.refName = ref.name ?? schema;
        return node;
      }
      const built = build(ref, input, ns);
      built.refName = ref.name ?? schema;
      return built;
    }
    node.types = [];
    node.description = `Unknown Avro type "${schema}"`;
    return node;
  }

  // Object form: { type, ... } possibly with a nested type definition.
  const o = schema;
  if (typeof o.type !== 'string') return build(o.type, input, o.namespace ?? ns);
  const id = fullName(o, ns);
  if (id) input.registry.set(id, o);
  if (o.name && !input.registry.has(o.name)) input.registry.set(o.name, o);
  const ancestors = id ? new Set(input.ancestors).add(id) : input.ancestors;
  const scope = o.namespace ?? ns;
  if (o.doc) node.description = o.doc;
  const logical = o.logicalType ? LOGICAL_FORMATS[o.logicalType] : undefined;
  if (logical !== undefined) node.format = logical;

  switch (o.type) {
    case 'record':
    case 'error': {
      node.types = ['object'];
      if (o.name) node.title = o.name;
      for (const f of o.fields ?? []) {
        const nullable = Array.isArray(f.type) && f.type.includes('null');
        const child = build(f.type, { name: f.name, path: childPath, required: !nullable, isRoot: false, ancestors, registry: input.registry }, scope);
        if (f.doc) child.description = f.doc;
        if (f.default !== undefined && f.default !== null) child.default = f.default;
        node.children.push(child);
      }
      return node;
    }
    case 'enum':
      node.types = ['string'];
      node.enum = o.symbols ?? [];
      if (o.name) node.title = o.name;
      return node;
    case 'array':
      node.types = ['array'];
      if (o.items !== undefined) node.children.push(build(o.items, { name: '[]', path: childPath, required: false, isRoot: false, ancestors, registry: input.registry }, scope));
      return node;
    case 'map':
      node.types = ['object'];
      if (o.values !== undefined) node.children.push(build(o.values, { name: '*', path: childPath, required: false, isRoot: false, ancestors, registry: input.registry }, scope));
      return node;
    case 'fixed':
      node.types = ['string'];
      node.format = node.format ?? 'bytes';
      if (o.size !== undefined) node.constraints.push({ key: 'maxLength', value: o.size });
      return node;
    default: {
      // A primitive with attributes, e.g. { type: "long", logicalType: "timestamp-millis" }.
      const inner = build(o.type, input, scope);
      if (node.format) inner.format = node.format;
      if (node.description) inner.description = node.description;
      return inner;
    }
  }
}

function variantTitle(m: Avro, i: number): string {
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return `Variant ${i + 1}`;
  if (m.name) return m.name;
  return typeof m.type === 'string' ? m.type : `Variant ${i + 1}`;
}
