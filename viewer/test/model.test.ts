import { describe, expect, it } from 'vitest';
import { checkDocument } from '../src/model/invariants.js';
import { accountsV2 } from './fixtures/expected/accounts-v2.js';
import { ordersV3 } from './fixtures/expected/orders-v3.js';

describe('hand-written fixtures satisfy the model invariants', () => {
  it('orders-v3', () => {
    expect(checkDocument(ordersV3)).toEqual([]);
  });
  it('accounts-v2', () => {
    expect(checkDocument(accountsV2)).toEqual([]);
  });
});

describe('model decisions visible in the fixtures', () => {
  it('v2 direction: subscribe sends, publish receives, badge keeps the keyword', () => {
    const [sub, pub] = accountsV2.operations;
    expect(sub).toMatchObject({ action: 'send', kind: 'send', badgeLabel: 'SUB' });
    expect(pub).toMatchObject({ action: 'receive', kind: 'receive', badgeLabel: 'PUB' });
    expect(sub?.locationHint).toBe('channels › user/signedup › subscribe');
  });

  it('v3 payload from a $ref carries refName and the same children as the component schema', () => {
    const payload = ordersV3.messages[0]?.payload;
    const schema = ordersV3.schemas[0]?.schema;
    expect(payload?.kind).toBe('node');
    expect(schema?.kind).toBe('node');
    if (payload?.kind !== 'node' || schema?.kind !== 'node') return;
    expect(payload.refName).toBe('Order');
    expect(payload.children).toEqual(schema.children);
  });

  it('array items: one "[]" node whose children carry the items[] path segment', () => {
    const schema = ordersV3.schemas[0]?.schema;
    if (schema?.kind !== 'node') throw new Error('expected a node');
    const items = schema.children.find((c) => c.name === 'items');
    expect(items?.children.map((c) => c.name)).toEqual(['[]']);
    expect(items?.children[0]?.children.map((c) => c.path)).toEqual([['items[]'], ['items[]'], ['items[]']]);
  });

  it('operations reuse the component message objects', () => {
    expect(ordersV3.operations[0]?.messages[0]).toBe(ordersV3.messages[0]);
    expect(accountsV2.operations[1]?.messages[0]).toBe(accountsV2.messages[1]);
  });
});

describe('the invariants catch broken models', () => {
  it('reports a required root, a duplicate anchor and a wrong path', () => {
    const doc = structuredClone(ordersV3);
    const payload = doc.messages[0]?.payload;
    if (payload?.kind !== 'node') throw new Error('expected a node');
    payload.required = true;
    payload.children[0]!.path = ['wrong'];
    doc.servers[1]!.anchor = doc.servers[0]!.anchor;
    const problems = checkDocument(doc);
    // The broken payload is reported twice: under its operation and under the Messages section.
    expect(problems).toHaveLength(5);
    expect(problems.join('\n')).toMatch(/never required/);
    expect(problems.join('\n')).toMatch(/duplicate anchor "production"/);
    expect(problems.join('\n')).toMatch(/path \[wrong\] should be \[\]/);
  });
});
