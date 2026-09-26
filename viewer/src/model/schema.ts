/**
 * Builds `SchemaNode` trees from JSON Schema (AsyncAPI flavour) and wraps other formats as
 * `RawSchema`.
 *
 * Rules (spec 3.3 and 4.8):
 * - `required` is read from the parent's array and set on each child.
 * - `type` becomes a list (`["string", "null"]` renders as `string | null`); untyped schemas
 *   with `properties` or `items` are inferred as object or array.
 * - `allOf` is merged into one node: parts (which may be `$ref`s into other documents) are
 *   flattened in order, later parts override same-named properties, `required` is the union.
 * - `oneOf` / `anyOf` keep their variants under `composition`; each variant is a node at the
 *   same level as its parent, titled by its `title`, its `$ref` name, or "Variant N".
 * - Arrays get one child named "[]"; tuple `items` get "[0]", "[1]", ...
 * - `additionalProperties` and `patternProperties` schemas become children named "*" and
 *   "/pattern/" so map-like objects are not shown as empty.
 * - A `$ref` to a schema already on the way down becomes a leaf with `circularRef`.
 * - Formats we cannot render as a tree (Avro, Protobuf, ...) become `RawSchema`.
 */
import { Context, isObj, str, type Obj } from './context.js';
import type { Composition, Constraint, ConstraintKey, RawSchema, Schema, SchemaNode } from './types.js';

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

  if (!isTreeFormat(format)) return rawSchema(format, value);
  // A root built from its own location still needs an identity so a schema that refers to
  // itself (components.schemas.Node -> #/components/schemas/Node) is caught at the first hop.
  return buildNode(ctx, value, {
    baseUrl,
    id: id ?? `${baseUrl}#${input.where}`,
    viaRef: id !== undefined,
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
  /** Identity for cycle detection: the resolved `$ref` id, or the root's own location. */
  id: string | undefined;
  /** True when the schema was reached through a `$ref`, which is what sets `refName`. */
  viaRef: boolean;
  name: string;
  path: string[];
  required: boolean;
  isRoot: boolean;
  ancestors: Set<string>;
  where: string;
}

/** One flattened `allOf` part: a schema object and the document it lives in. */
interface Part {
  value: Obj;
  baseUrl: string;
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
  const refName = input.viaRef ? Context.schemaName(input.id) : undefined;
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
    node.circularRef = Context.schemaName(input.id) ?? Context.keyOf(input.id) ?? input.id;
    node.types = typesOf(value);
    return node;
  }
  const ancestors = input.id === undefined ? input.ancestors : new Set(input.ancestors).add(input.id);

  // Flatten the schema and its allOf parts (recursively) into an ordered list.
  const parts: Part[] = [];
  flatten(ctx, { value, baseUrl: input.baseUrl, where: input.where }, parts, ancestors, new Set());

  node.types = firstNonEmpty(parts.map((p) => typesOf(p.value))) ?? [];
  firstString(parts, 'format', (v) => (node.format = v));
  firstString(parts, 'title', (v) => (node.title = v));
  firstString(parts, 'description', (v) => (node.description = v));
  for (const p of parts) {
    if (node.enum === undefined && Array.isArray(p.value['enum'])) node.enum = p.value['enum'];
    if (node.const === undefined && 'const' in p.value) node.const = p.value['const'];
    if (node.default === undefined && 'default' in p.value) node.default = p.value['default'];
    if (node.examples === undefined && Array.isArray(p.value['examples'])) node.examples = p.value['examples'];
    if (p.value['deprecated'] === true) node.deprecated = true;
    if (p.value['readOnly'] === true) node.readOnly = true;
    if (p.value['writeOnly'] === true) node.writeOnly = true;
  }
  node.constraints = mergeConstraints(parts.map((p) => p.value));

  const childPath = input.isRoot
    ? []
    : input.name === '[]'
      ? [...input.path.slice(0, -1), `${input.path[input.path.length - 1] ?? ''}[]`]
      : [...input.path, input.name];

  // Properties: union of all parts, later parts replace earlier ones in place.
  const required = new Set<string>();
  for (const p of parts) {
    if (Array.isArray(p.value['required'])) for (const r of p.value['required']) if (typeof r === 'string') required.add(r);
  }
  const byName = new Map<string, number>();
  for (const p of parts) {
    const properties = p.value['properties'];
    if (!isObj(properties)) continue;
    for (const [name, raw] of Object.entries(properties)) {
      const built = child(ctx, raw, name, required.has(name), p.baseUrl, ancestors, childPath, `${p.where}/properties/${name}`);
      const at = byName.get(name);
      if (at === undefined) {
        byName.set(name, node.children.length);
        node.children.push(built);
      } else {
        node.children[at] = built;
      }
    }
  }
  if (node.types.length === 0 && node.children.length > 0) node.types = ['object'];

  // Items: from the first part that has them.
  const itemsPart = parts.find((p) => p.value['items'] !== undefined);
  if (itemsPart && (node.types.includes('array') || node.types.length === 0)) {
    if (node.types.length === 0) node.types = ['array'];
    const items = itemsPart.value['items'];
    if (Array.isArray(items)) {
      items.forEach((raw, i) => {
        node.children.push(child(ctx, raw, `[${i}]`, false, itemsPart.baseUrl, ancestors, childPath, `${itemsPart.where}/items/${i}`));
      });
    } else {
      node.children.push(child(ctx, items, '[]', false, itemsPart.baseUrl, ancestors, childPath, `${itemsPart.where}/items`));
    }
  }

  // Map-like objects.
  for (const p of parts) {
    const additional = p.value['additionalProperties'];
    if (isObj(additional) && !byName.has('*')) {
      byName.set('*', node.children.length);
      node.children.push(child(ctx, additional, '*', false, p.baseUrl, ancestors, childPath, `${p.where}/additionalProperties`));
    }
    const patterns = p.value['patternProperties'];
    if (isObj(patterns)) {
      for (const [pattern, raw] of Object.entries(patterns)) {
        const name = `/${pattern}/`;
        if (byName.has(name)) continue;
        byName.set(name, node.children.length);
        node.children.push(child(ctx, raw, name, false, p.baseUrl, ancestors, childPath, `${p.where}/patternProperties/${pattern}`));
      }
    }
  }

  // oneOf / anyOf: from the first part that has one (oneOf wins over anyOf within a part).
  for (const p of parts) {
    const kind = Array.isArray(p.value['oneOf']) ? 'oneOf' : Array.isArray(p.value['anyOf']) ? 'anyOf' : undefined;
    if (!kind) continue;
    const list = p.value[kind] as unknown[];
    const composition: Composition = { kind, variants: [] };
    list.forEach((raw, i) => {
      const located = ctx.resolver.deref(raw, p.baseUrl);
      const where = `${p.where}/${kind}/${i}`;
      if ('error' in located) {
        ctx.problem('error', located.error, where);
        return;
      }
      const variantNode = buildNode(ctx, located.value, {
        baseUrl: located.baseUrl,
        id: located.id,
        viaRef: located.id !== undefined,
        name: input.name,
        path: input.path,
        required: input.required,
        isRoot: input.isRoot,
        ancestors,
        where,
      });
      const title = (isObj(located.value) ? str(located.value['title']) : undefined) ?? variantNode.refName ?? `Variant ${i + 1}`;
      composition.variants.push({ title, node: variantNode });
    });
    if (composition.variants.length > 0) node.composition = composition;
    break;
  }
  return node;
}

/** Depth-first flattening of `allOf` with a cycle guard; the schema itself comes first. */
function flatten(ctx: Context, part: Part, out: Part[], ancestors: Set<string>, seen: Set<string>): void {
  out.push(part);
  const allOf = part.value['allOf'];
  if (!Array.isArray(allOf)) return;
  allOf.forEach((raw, i) => {
    const where = `${part.where}/allOf/${i}`;
    const located = ctx.resolver.deref(raw, part.baseUrl);
    if ('error' in located) {
      ctx.problem('error', located.error, where);
      return;
    }
    if (!isObj(located.value)) {
      if (located.value !== true) ctx.problem('warning', `Expected a schema at "${where}"; it was skipped.`, where);
      return;
    }
    if (located.id !== undefined) {
      if (ancestors.has(located.id) || seen.has(located.id)) {
        ctx.problem('warning', `allOf at "${where}" refers back to a schema already being merged; it was skipped.`, where);
        return;
      }
      seen.add(located.id);
    }
    flatten(ctx, { value: located.value, baseUrl: located.baseUrl, where }, out, ancestors, seen);
  });
}

function child(
  ctx: Context,
  raw: unknown,
  name: string,
  required: boolean,
  baseUrl: string,
  ancestors: Set<string>,
  path: string[],
  where: string,
): SchemaNode {
  const located = ctx.resolver.deref(raw, baseUrl);
  if ('error' in located) {
    ctx.problem('error', located.error, where);
    return { kind: 'node', name, path, types: [], required, constraints: [], children: [] };
  }
  return buildNode(ctx, located.value, {
    baseUrl: located.baseUrl,
    id: located.id,
    viaRef: located.id !== undefined,
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
  if (isObj(schema['properties'])) return ['object'];
  if (schema['items'] !== undefined) return ['array'];
  return [];
}

function mergeConstraints(schemas: Obj[]): Constraint[] {
  const out: Constraint[] = [];
  for (const key of CONSTRAINT_ORDER) {
    for (const schema of schemas) {
      const v = schema[key];
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
        out.push({ key, value: v });
        break;
      }
    }
  }
  return out;
}

function firstNonEmpty(lists: string[][]): string[] | undefined {
  return lists.find((l) => l.length > 0);
}

function firstString(parts: Part[], key: string, set: (v: string) => void): void {
  for (const p of parts) {
    const v = str(p.value[key]);
    if (v !== undefined) {
      set(v);
      return;
    }
  }
}
