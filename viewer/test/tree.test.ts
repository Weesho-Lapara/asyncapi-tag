import { describe, expect, it } from 'vitest';
import type { SchemaNode } from '../src/model/types.js';
import { TreeState, typeLabel } from '../src/render/tree.js';

function node(partial: Partial<SchemaNode> & { name: string }): SchemaNode {
  return { kind: 'node', path: [], types: [], required: false, constraints: [], children: [], ...partial };
}

describe('typeLabel', () => {
  it('joins unions, appends format, folds primitive array items and describes compositions', () => {
    expect(typeLabel(node({ name: 'a', types: ['string'] }))).toBe('string');
    expect(typeLabel(node({ name: 'a', types: ['string', 'null'] }))).toBe('string | null');
    expect(typeLabel(node({ name: 'a', types: ['string'], format: 'uuid' }))).toBe('string · uuid');
    expect(typeLabel(node({ name: 'a', format: 'email' }))).toBe('string · email');
    const tags = node({ name: 'tags', types: ['array'], children: [node({ name: '[]', types: ['string'] })] });
    expect(typeLabel(tags)).toBe('array of string');
    const matrix = node({ name: 'm', types: ['array'], children: [node({ name: '[]', types: ['array'], children: [node({ name: '[]', types: ['number'] })] })] });
    expect(typeLabel(matrix)).toBe('array of array of number');
    const items = node({ name: 'items', types: ['array'], children: [node({ name: '[]', types: ['object'], children: [node({ name: 'sku' })] })] });
    expect(typeLabel(items)).toBe('array of object');
    expect(typeLabel(node({ name: 'x', composition: { kind: 'oneOf', variants: [] } }))).toBe('oneOf');
    expect(typeLabel(node({ name: 'x', circularRef: 'Node' }))).toBe('object');
    expect(typeLabel(node({ name: 'x' }))).toBe('');
  });
});

describe('TreeState', () => {
  it('opens levels 1 to 3 by default, toggles per node, and expand/collapse all override', () => {
    let changes = 0;
    const s = new TreeState(() => changes++);
    expect(s.isExpanded('a', 1)).toBe(true);
    expect(s.isExpanded('a/b', 2)).toBe(true);
    expect(s.isExpanded('a/b/c', 3)).toBe(false);
    s.toggle('a/b/c', 3);
    expect(s.isExpanded('a/b/c', 3)).toBe(true);
    s.toggle('a', 1);
    expect(s.isExpanded('a', 1)).toBe(false);
    s.setAll(true);
    expect(s.isExpanded('a', 1)).toBe(true);
    expect(s.isExpanded('deep', 7)).toBe(true);
    s.setAll(false);
    expect(s.isExpanded('a', 1)).toBe(false);
    s.toggle('a', 1);
    expect(s.isExpanded('a', 1)).toBe(true);
    expect(changes).toBe(5);
  });

  it('remembers the selected variant per composition', () => {
    const s = new TreeState(() => undefined);
    expect(s.variant('x')).toBe(0);
    s.selectVariant('x', 2);
    expect(s.variant('x')).toBe(2);
    expect(s.variant('y')).toBe(0);
  });
});
