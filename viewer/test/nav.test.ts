import { describe, expect, it } from 'vitest';
import { buildNavItems, filterNav, groupNav, matches, type NavOptions } from '../src/render/nav.js';
import { accountsV2 } from './fixtures/expected/accounts-v2.js';
import { ordersV3 } from './fixtures/expected/orders-v3.js';

const base: NavOptions = { info: true, servers: true, messages: true, schemas: true, showServers: 'byDefault', showOperations: 'byDefault' };

describe('buildNavItems', () => {
  it('lists sections, flat operations and the Components group', () => {
    const items = buildNavItems(ordersV3, ordersV3.operations, 'v', base);
    expect(items.map((i) => [i.kind, i.label, i.group])).toEqual([
      ['section', 'Orders service', undefined],
      ['section', 'Servers', undefined],
      ['operation', 'emitOrderPlaced', undefined],
      ['operation', 'onOrderShipped', undefined],
      ['section', 'Messages', 'Components'],
      ['section', 'Schemas', 'Components'],
    ]);
    expect(items[2]).toMatchObject({ anchor: 'v--operations--emitOrderPlaced', badge: { label: 'SEND', action: 'send' }, sub: 'orders.placed' });
    expect(items[2]?.search).toEqual(['emitorderplaced', 'emitorderplaced', 'orders.placed', 'orderplaced', 'order placed']);
    expect(items[4]?.count).toBe(2);
  });

  it('groups operations by their own tags or by document tags, untagged under Other', () => {
    const own = buildNavItems(ordersV3, ordersV3.operations, 'v', { ...base, showOperations: 'byOperationsTags' });
    expect(own.filter((i) => i.kind === 'operation').map((i) => i.group)).toEqual(['orders', 'fulfilment']);
    // orders-v3 declares no document tags: everything is Other under bySpecTags.
    const spec = buildNavItems(ordersV3, ordersV3.operations, 'v', { ...base, showOperations: 'bySpecTags' });
    expect(spec.filter((i) => i.kind === 'operation').map((i) => i.group)).toEqual(['Other', 'Other']);
    const v2 = buildNavItems(accountsV2, accountsV2.operations, 'v', { ...base, showOperations: 'bySpecTags' });
    expect(v2.filter((i) => i.kind === 'operation').map((i) => i.group)).toEqual(['accounts', 'security']);
  });

  it('lists servers under the Servers link only when a grouping mode is on, and honours hidden sections', () => {
    const grouped = buildNavItems(accountsV2, accountsV2.operations, 'v', { ...base, showServers: 'byServersTags' });
    expect(grouped.filter((i) => i.kind === 'server').map((i) => [i.label, i.group])).toEqual([
      ['production', 'accounts'],
      ['audit', 'security'],
    ]);
    const hidden = buildNavItems(accountsV2, [], 'v', { ...base, info: false, servers: false, schemas: false });
    expect(hidden.map((i) => i.label)).toEqual(['Messages']);
  });
});

describe('search', () => {
  const items = buildNavItems(ordersV3, ordersV3.operations, 'v', base);

  it('every term must match; case-insensitive substrings over heading, id, address and message names', () => {
    const emit = items[2]!;
    expect(matches(emit, 'Orders.')).toBe(true);
    expect(matches(emit, 'order placed')).toBe(true);
    expect(matches(emit, 'shipped')).toBe(false);
    expect(matches(emit, '')).toBe(true);
  });

  it('hides section links during a query unless kept, reports counts, and keeps document order', () => {
    const r = filterNav(items, 'orders', false);
    expect(r.items.map((i) => i.label)).toEqual(['emitOrderPlaced', 'onOrderShipped']);
    expect([r.shown, r.total, r.active]).toEqual([2, 2, true]);
    const kept = filterNav(items, 'shipped', true);
    expect(kept.items.map((i) => i.label)).toEqual(['Orders service', 'Servers', 'onOrderShipped', 'Messages', 'Schemas']);
    expect(kept.shown).toBe(1);
    const none = filterNav(items, 'zzz', false);
    expect(none.items).toEqual([]);
    expect(filterNav(items, '   ', false).active).toBe(false);
  });

  it('groups consecutive items; groups with no matches disappear', () => {
    const grouped = buildNavItems(accountsV2, accountsV2.operations, 'v', { ...base, showOperations: 'bySpecTags' });
    const r = filterNav(grouped, 'login', false);
    expect(groupNav(r.items).map((g) => [g.group, g.items.length])).toEqual([['security', 1]]);
    expect(groupNav(grouped).map((g) => g.group)).toEqual([undefined, 'accounts', 'security', 'Components']);
  });
});
