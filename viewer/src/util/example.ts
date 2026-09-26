/**
 * Generated examples (ROADMAP amendment 9). When a message has no authored example, one is
 * built from the schema so readers get a taste of real traffic. Values come from, in order:
 * the field's own examples or default, const, the first enum value, the format, numeric bounds,
 * then field-name heuristics. Never a bare "string" or 0 when a hint exists.
 */
import type { Schema, SchemaNode } from '../model/types.js';

export function generateExample(schema: Schema | undefined): unknown {
  if (!schema || schema.kind !== 'node') return undefined;
  return fromNode(schema, 0);
}

const MAX_DEPTH = 8;

function fromNode(node: SchemaNode, depth: number): unknown {
  if (node.examples && node.examples.length > 0) return node.examples[0];
  if (node.default !== undefined) return node.default;
  if (node.const !== undefined) return node.const;
  if (node.enum && node.enum.length > 0) return node.enum[0];
  if (node.circularRef !== undefined || depth > MAX_DEPTH) return null;

  const item = node.children.length === 1 && node.children[0]!.name === '[]' ? node.children[0] : undefined;
  const type = pickType(node);

  if (node.composition && node.composition.variants.length > 0 && node.children.length === 0 && !item) {
    return fromNode(node.composition.variants[0]!.node, depth);
  }
  if (type === 'array' || item) {
    if (item) return [fromNode(item, depth + 1)];
    const tuple = node.children.filter((c) => /^\[\d+\]$/.test(c.name));
    return tuple.map((c) => fromNode(c, depth + 1));
  }
  if (type === 'object' || node.children.length > 0) {
    const out: Record<string, unknown> = {};
    for (const child of node.children) {
      if (child.name === '*') out['key'] = fromNode(child, depth + 1);
      else if (child.name.startsWith('/')) out['x-example'] = fromNode(child, depth + 1);
      else out[child.name] = fromNode(child, depth + 1);
    }
    if (node.composition && node.composition.variants.length > 0) {
      Object.assign(out, asObject(fromNode(node.composition.variants[0]!.node, depth)));
    }
    return out;
  }
  switch (type) {
    case 'string':
      return stringFor(node);
    case 'integer':
      return integerFor(node);
    case 'number':
      return numberFor(node);
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      return stringFor(node);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickType(node: SchemaNode): string | undefined {
  return node.types.find((t) => t !== 'null') ?? node.types[0];
}

function bound(node: SchemaNode, key: string): number | undefined {
  const c = node.constraints.find((x) => x.key === key);
  return typeof c?.value === 'number' ? c.value : undefined;
}

function integerFor(node: SchemaNode): number {
  const min = bound(node, 'minimum') ?? (bound(node, 'exclusiveMinimum') !== undefined ? bound(node, 'exclusiveMinimum')! + 1 : undefined);
  const max = bound(node, 'maximum') ?? (bound(node, 'exclusiveMaximum') !== undefined ? bound(node, 'exclusiveMaximum')! - 1 : undefined);
  const name = node.name.toLowerCase();
  let value = /quantity|count|qty|items|size/.test(name) ? 2 : /age/.test(name) ? 34 : /year/.test(name) ? 2026 : /port/.test(name) ? 8080 : 42;
  if (min !== undefined && value < min) value = min;
  if (max !== undefined && value > max) value = max;
  return value;
}

function numberFor(node: SchemaNode): number {
  const min = bound(node, 'minimum') ?? bound(node, 'exclusiveMinimum');
  const max = bound(node, 'maximum') ?? bound(node, 'exclusiveMaximum');
  const name = node.name.toLowerCase();
  let value = /price|amount|total|cost|fee/.test(name) ? 12.5 : /lat/.test(name) ? 52.37 : /lon|lng/.test(name) ? 4.89 : /percent|ratio|rate/.test(name) ? 0.25 : 3.14;
  if (min !== undefined && value <= min) value = min + 1;
  if (max !== undefined && value >= max) value = max - 1;
  return value;
}

function stringFor(node: SchemaNode): string {
  const format = node.format?.toLowerCase();
  const name = node.name;
  const lower = name.toLowerCase();
  let value: string | undefined;
  switch (format) {
    case 'uuid':
      value = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      break;
    case 'email':
    case 'idn-email':
      value = 'ada@example.com';
      break;
    case 'date-time':
      value = '2026-09-26T10:15:00Z';
      break;
    case 'date':
      value = '2026-09-26';
      break;
    case 'time':
      value = '10:15:00Z';
      break;
    case 'duration':
      value = 'PT15M';
      break;
    case 'uri':
    case 'url':
    case 'iri':
    case 'uri-reference':
      value = 'https://example.com/resource/42';
      break;
    case 'hostname':
      value = 'broker.example.com';
      break;
    case 'ipv4':
      value = '192.0.2.10';
      break;
    case 'ipv6':
      value = '2001:db8::10';
      break;
    case 'byte':
      value = 'aGVsbG8=';
      break;
    case 'binary':
      value = '<binary>';
      break;
    case 'password':
      value = '••••••••';
      break;
  }
  if (value === undefined) {
    if (/^id$|Id$|_id$|Ref$|Key$/.test(name)) {
      const stem = name.replace(/Id$|_id$|Ref$|Key$/, '').replace(/^id$/, 'item') || 'item';
      value = `${stem.slice(0, 3).toLowerCase()}_01HZ3`;
    } else if (/email/.test(lower)) value = 'ada@example.com';
    else if (/^(url|uri|link|href)$|url$|uri$/i.test(name)) value = 'https://example.com/resource/42';
    else if (/phone|tel/.test(lower)) value = '+31 20 555 0100';
    else if (/currency/.test(lower)) value = 'EUR';
    else if (/country/.test(lower)) value = 'NL';
    else if (/lang|locale/.test(lower)) value = 'en-GB';
    else if (/^(name|displayname|fullname)$/.test(lower)) value = 'Ada Lovelace';
    else if (/firstname|givenname/.test(lower)) value = 'Ada';
    else if (/lastname|surname|familyname/.test(lower)) value = 'Lovelace';
    else if (/username|login|handle/.test(lower)) value = 'ada';
    else if (/status|state/.test(lower)) value = 'active';
    else if (/type|kind|category/.test(lower)) value = 'standard';
    else if (/sku|code/.test(lower)) value = 'MUG-TEAL-01';
    else if (/description|text|message|comment|body|note|reason/.test(lower)) value = 'Example text';
    else if (/title|subject/.test(lower)) value = 'Example title';
    else if (/at$|time|date/.test(lower)) value = '2026-09-26T10:15:00Z';
    else if (/token|secret|key/.test(lower)) value = 'tok_9f8e7d6c';
    else if (/version/.test(lower)) value = '1.0.0';
    else if (/city/.test(lower)) value = 'Amsterdam';
    else if (/street|address/.test(lower)) value = 'Herengracht 1';
    else if (/zip|postal/.test(lower)) value = '1015 BA';
    else if (/color|colour/.test(lower)) value = 'teal';
    else value = name && !/^[[*/]/.test(name) ? `${name}-example` : 'example';
  }
  const min = bound(node, 'minLength');
  const max = bound(node, 'maxLength');
  if (min !== undefined && value.length < min) value = value.padEnd(min, 'x');
  if (max !== undefined && value.length > max) value = value.slice(0, max);
  return value;
}
