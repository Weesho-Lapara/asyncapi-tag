/**
 * Builds `SchemaNode` trees from JSON Schema (AsyncAPI flavour) and wraps other formats as
 * `RawSchema`. Chunk 1.4 covers objects, arrays, required flags, types and formats, enum,
 * const, default, examples, constraints, `$ref` names and circular references. Composition
 * (`allOf` merge, `oneOf`/`anyOf` variants) arrives in chunk 1.6.
 */
import { Context, isObj, str, type Obj } from './context.js';
import type { Constraint, ConstraintKey, RawSchema, Schema, SchemaNode } from './types.js';

const CONSTRAINT_ORDER: ConstraintKey[] = [
  'minimum',
  'exclusiveMinimum',
  'maximum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
];

/** Formats we can render as a tree. Anything else becomes a RawSchema. */
export function isTreeFormat(schemaFormat: string): boolean {
  const f = schemaFormat.toLowerCase();
  return f.includes('vnd.aai.asyncapi') || f.includes('json-schema') || f.includes('schema+json') || f.includes('schema+yaml');
}

export interface BuildInput {
  /** The schema as written: a schema object, a `$ref`, a boolean, or a Multi Format Schema Object. */
  raw: unknown;
  baseUrl: string;
  where: string;
  /** Root name: "" for payload/headers, the key for components.schemas. */
  name: string;
  /** Applies when `raw` is a plain schema object without its own `schemaFormat`. */
  defaultFormat: string;
}

/** Build a payload, headers or component schema. Handles the Multi Format Schema Object. */
export function buildSchema(ctx: Context, input: BuildInput): Schema | undefined {
  if (input.raw === undefined) return undefined;
  const located = ctx.resolver.deref(input.raw, input.baseUrl);
  if ('error' in located) {
    ctx.problem('error', located.error, input.where);
    return undefined;
  }
  let value = located.value;
  let baseUrl = located.baseUrl;
  let id = located.id;
  let format = input.defaultFormat;

  // Multi Format Schema Object: { schemaFormat, schema }
  if (isObj(value) && typeof value['schemaFormat'] === 'string' && 'schema' in value) {
    format = value['schemaFormat'];
    const inner = ctx.resolver.deref(value['schema'], baseUrl);
    if ('error' in inner) {
      ctx.problem('error', inner.error, `${input.where}/schema`);
      return undefined;
    }
    value = inner.value;
    baseUrl = inner.baseUrl;
    id = inner.id ?? id;
  }

  if (!isTreeFormat(format)) {
    return rawSchema(format, value);
  }
  return buildNode(ctx, value, {
    baseUrl,
    id,
    name: input.name,
    path: [],
    required: false,
    isRoot: true,
    ancestors: new Set(),
    where: input.where,
  });
}

function rawSchema(schemaFormat: string, value: unknown): RawSchema {
  const source = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { kind: 'raw', schemaFormat, source };
}

interface NodeInput {
  baseUrl: string;
  /** Resolved id when the schema came through a `$ref`; drives refName and cycle detection. */
  id: string | undefined;
  name: string;
  path: string[];
  required: boolean;
  isRoot: boolean;
  ancestors: Set<string>;
  where: string;
}

function buildNode(ctx: Context, value: unknown, input: NodeInput): SchemaNode {
  const node: SchemaNode = {
    kind: 'node',
    name: input.name,
    path: input.path,
    types: [],
    required: input.required,
    constraints: [],
    children: [],
  };
  const refName = Context.schemaName(input.id);
  if (refName !== undefined) node.refName = refName;

  if (value === true || value === undefined) return node; // "any"
  if (value === false) {
    node.types = ['never'];
    return node;
  }
  if (!isObj(value)) {
    ctx.problem('warning', `Expected a schema at "${input.where}" but found ${typeof value}; it was shown as untyped.`, input.where);
    return node;
  }

  if (input.id !== undefined && input.ancestors.has(input.id)) {
    node.circularRef = refName ?? Context.keyOf(input.id) ?? input.id;
    node.types = typesOf(value);
    return node;
  }
  const ancestors = input.id === undefined ? input.ancestors : new Set(input.ancestors).add(input.id);

  node.types = typesOf(value);
  copyString(value, 'format', (v) => (node.format = v));
  copyString(value, 'title', (v) => (node.title = v));
  copyString(value, 'description', (v) => (node.description = v));
  if (Array.isArray(value['enum'])) node.enum = value['enum'];
  if ('const' in value) node.const = value['const'];
  if ('default' in value) node.default = value['default'];
  if (Array.isArray(value['examples'])) node.examples = value['examples'];
  if (value['deprecated'] === true) node.deprecated = true;
  if (value['readOnly'] === true) node.readOnly = true;
  if (value['writeOnly'] === true) node.writeOnly = true;
  node.constraints = constraintsOf(value);

  const childPath = input.isRoot
    ? []
    : input.name === '[]'
      ? [...input.path.slice(0, -1), `${input.path[input.path.length - 1] ?? ''}[]`]
      : [...input.path, input.name];

  const properties = value['properties'];
  if (isObj(properties)) {
    const required = new Set(Array.isArray(value['required']) ? value['required'].filter((r) => typeof r === 'string') : []);
    for (const [name, raw] of Object.entries(properties)) {
      node.children.push(child(ctx, raw, name, required.has(name), input, ancestors, childPath, `${input.where}/properties/${name}`));
    }
  }

  const items = value['items'];
  if (items !== undefined && node.types.includes('array')) {
    if (Array.isArray(items)) {
      items.forEach((raw, i) => {
        node.children.push(child(ctx, raw, `[${i}]`, false, input, ancestors, childPath, `${input.where}/items/${i}`));
      });
    } else {
      node.children.push(child(ctx, items, '[]', false, input, ancestors, childPath, `${input.where}/items`));
    }
  }
  return node;
}

function child(
  ctx: Context,
  raw: unknown,
  name: string,
  required: boolean,
  parent: NodeInput,
  ancestors: Set<string>,
  path: string[],
  where: string,
): SchemaNode {
  const located = ctx.resolver.deref(raw, parent.baseUrl);
  if ('error' in located) {
    ctx.problem('error', located.error, where);
    return { kind: 'node', name, path, types: [], required, constraints: [], children: [] };
  }
  return buildNode(ctx, located.value, {
    baseUrl: located.baseUrl,
    id: located.id,
    name,
    path,
    required,
    isRoot: false,
    ancestors,
    where,
  });
}

function typesOf(schema: Obj): string[] {
  const t = schema['type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  // Infer from structure so untyped object/array schemas still render as trees.
  if (isObj(schema['properties'])) return ['object'];
  if (schema['items'] !== undefined) return ['array'];
  return [];
}

function constraintsOf(schema: Obj): Constraint[] {
  const out: Constraint[] = [];
  for (const key of CONSTRAINT_ORDER) {
    const v = schema[key];
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out.push({ key, value: v });
  }
  return out;
}

function copyString(schema: Obj, key: string, set: (v: string) => void): void {
  const v = str(schema[key]);
  if (v !== undefined) set(v);
}
