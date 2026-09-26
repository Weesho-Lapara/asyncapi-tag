/**
 * Structural rules every normalised Document must satisfy, whatever produced it.
 * Used by the fixture tests now and by the normaliser tests and the coverage gate later.
 * Returns human-readable violations; an empty array means the document is well formed.
 */
import type { Document, Schema, SchemaNode } from './types.js';

const ANCHOR = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

const CONSTRAINT_KEYS = new Set([
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
]);

export function checkDocument(doc: Document): string[] {
  const out: string[] = [];
  const fail = (msg: string) => out.push(msg);

  const major = Number(doc.specVersion.split('.')[0]);
  if (major !== doc.specMajor) fail(`specMajor ${doc.specMajor} does not match specVersion ${doc.specVersion}`);
  if (!doc.title) fail('title is empty');

  checkAnchors('servers', doc.servers.map((s) => s.anchor), fail);
  checkAnchors('operations', doc.operations.map((o) => o.anchor), fail);
  checkAnchors('messages', doc.messages.map((m) => m.anchor), fail);
  checkAnchors('schemas', doc.schemas.map((s) => s.anchor), fail);

  const serverIds = new Set(doc.servers.map((s) => s.id));
  const schemaIds = new Set(doc.schemas.map((s) => s.id));

  for (const op of doc.operations) {
    const at = `operation ${op.id}`;
    if (op.action === 'send' && op.kind !== 'send' && op.kind !== 'request') fail(`${at}: action send with kind ${op.kind}`);
    if (op.action === 'receive' && op.kind !== 'receive' && op.kind !== 'reply') fail(`${at}: action receive with kind ${op.kind}`);
    const needsReply = op.kind === 'request' || op.kind === 'reply';
    if (needsReply !== (op.reply !== undefined)) fail(`${at}: kind ${op.kind} but reply is ${op.reply ? 'present' : 'absent'}`);
    if (!op.badgeLabel) fail(`${at}: empty badgeLabel`);
    if (!op.heading) fail(`${at}: empty heading`);
    for (const id of op.channel.servers) {
      if (!serverIds.has(id)) fail(`${at}: channel server "${id}" is not a known server`);
    }
    for (const m of op.messages) checkMessage(m, `${at} message ${m.id}`, schemaIds, fail);
  }
  for (const m of doc.messages) checkMessage(m, `message ${m.id}`, schemaIds, fail);
  for (const s of doc.schemas) {
    if (s.schema.kind === 'node') {
      if (s.schema.name !== s.id) fail(`schema ${s.id}: root name "${s.schema.name}" should equal its id`);
      checkNode(s.schema, `schema ${s.id}`, [], true, schemaIds, fail);
    }
  }
  return out;
}

function checkAnchors(section: string, anchors: string[], fail: (m: string) => void): void {
  const seen = new Set<string>();
  for (const a of anchors) {
    if (!ANCHOR.test(a)) fail(`${section}: anchor "${a}" is not a safe slug`);
    if (seen.has(a)) fail(`${section}: duplicate anchor "${a}"`);
    seen.add(a);
  }
}

function checkMessage(
  m: { contentType: string; schemaFormat: string; payload?: Schema; headers?: Schema },
  at: string,
  schemaIds: Set<string>,
  fail: (m: string) => void,
): void {
  if (!m.contentType) fail(`${at}: empty contentType`);
  if (!m.schemaFormat) fail(`${at}: empty schemaFormat`);
  for (const [label, schema] of [
    ['payload', m.payload],
    ['headers', m.headers],
  ] as const) {
    if (!schema || schema.kind !== 'node') continue;
    if (schema.name !== '') fail(`${at} ${label}: root name should be "" but is "${schema.name}"`);
    checkNode(schema, `${at} ${label}`, [], true, schemaIds, fail);
  }
}

function checkNode(
  node: SchemaNode,
  at: string,
  expectedPath: string[],
  isRoot: boolean,
  schemaIds: Set<string>,
  fail: (m: string) => void,
): void {
  const here = `${at} › ${node.name || '(root)'}`;
  if (isRoot && node.required) fail(`${here}: root nodes are never required`);
  if (!sameList(node.path, expectedPath)) fail(`${here}: path [${node.path}] should be [${expectedPath}]`);
  for (const c of node.constraints) {
    if (!CONSTRAINT_KEYS.has(c.key)) fail(`${here}: unknown constraint ${c.key}`);
  }
  if (node.circularRef !== undefined && node.children.length > 0) fail(`${here}: circular reference with children`);
  if (node.refName !== undefined && schemaIds.size > 0 && !schemaIds.has(node.refName)) {
    fail(`${here}: refName "${node.refName}" is not a component schema`);
  }
  const isArray = node.types.includes('array');
  const itemChildren = node.children.filter((c) => c.name === '[]');
  if (itemChildren.length > 1) fail(`${here}: more than one "[]" item node`);
  if (itemChildren.length === 1 && !isArray) fail(`${here}: "[]" item node on a non-array`);
  if (itemChildren.length === 1 && node.children.length !== 1) fail(`${here}: array with properties besides "[]"`);

  // Children's path: root contributes nothing; an item node contributes "<array>[]" in place of
  // its parent's segment; every other node contributes its name.
  const childPath = isRoot
    ? []
    : node.name === '[]'
      ? [...expectedPath.slice(0, -1), `${expectedPath[expectedPath.length - 1]}[]`]
      : [...expectedPath, node.name];
  for (const child of node.children) checkNode(child, at, childPath, false, schemaIds, fail);
  if (node.composition) {
    node.composition.variants.forEach((v, i) => {
      if (!v.title) fail(`${here}: variant ${i + 1} has no title`);
      checkNode(v.node, `${here} variant ${i + 1}`, expectedPath, false, schemaIds, fail);
    });
  }
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
