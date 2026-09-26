/**
 * The sidebar's data (ROADMAP amendment 11): one generic list of nav items built once per
 * render, which the sidebar renders and the search filters. Sections and operations today;
 * messages and schemas can join later without touching search, grouping or highlighting.
 */
import type { Document, Operation, OperationAction } from '../model/types.js';
import type { GroupOperations, GroupServers } from '../options.js';

export type NavKind = 'section' | 'server' | 'operation' | 'message' | 'schema';

export interface NavItem {
  kind: NavKind;
  label: string;
  /** Full page anchor id (element id, section, item). */
  anchor: string;
  /** Group heading; items without one are listed flat. */
  group?: string;
  badge?: { label: string; action: OperationAction };
  /** Second line, e.g. the channel address. */
  sub?: string;
  /** Right-hand count, for the Messages and Schemas links. */
  count?: number;
  /** Lower-cased strings the search matches against. */
  search: string[];
}

export interface NavOptions {
  info: boolean;
  servers: boolean;
  messages: boolean;
  schemas: boolean;
  showServers: GroupServers;
  showOperations: GroupOperations;
}

export function buildNavItems(doc: Document, operations: Operation[], prefix: string, options: NavOptions): NavItem[] {
  const items: NavItem[] = [];
  if (options.info) items.push({ kind: 'section', label: 'Overview', anchor: `${prefix}--info`, search: [] });
  if (options.servers && doc.servers.length > 0) {
    items.push({ kind: 'section', label: 'Servers', anchor: `${prefix}--servers`, count: doc.servers.length, search: [] });
    if (options.showServers !== 'byDefault') {
      for (const s of doc.servers) {
        const group = groupFor(s.tags.map((t) => t.name), doc, options.showServers === 'bySpecTags');
        items.push({ kind: 'server', label: s.id, anchor: `${prefix}--servers--${s.anchor}`, group, sub: s.hostDisplay, search: [] });
      }
    }
  }
  for (const op of operations) {
    const group = options.showOperations === 'byDefault' ? undefined : groupFor(op.tags.map((t) => t.name), doc, options.showOperations === 'bySpecTags');
    const item: NavItem = {
      kind: 'operation',
      label: op.heading,
      anchor: `${prefix}--operations--${op.anchor}`,
      badge: { label: op.badgeLabel, action: op.action },
      search: [op.heading, op.id, op.channel.address ?? '', ...op.messages.flatMap((m) => [m.name ?? '', m.title ?? ''])]
        .filter((s) => s !== '')
        .map((s) => s.toLowerCase()),
    };
    if (group !== undefined) item.group = group;
    if (op.channel.address !== null) item.sub = op.channel.address;
    items.push(item);
  }
  if (options.messages && doc.messages.length > 0) {
    items.push({ kind: 'section', label: 'Messages', anchor: `${prefix}--messages`, group: 'Components', count: doc.messages.length, search: [] });
  }
  if (options.schemas && doc.schemas.length > 0) {
    items.push({ kind: 'section', label: 'Schemas', anchor: `${prefix}--schemas`, group: 'Components', count: doc.schemas.length, search: [] });
  }
  return items;
}

/** bySpecTags: the first document-level tag the item carries, in document order; else its own first tag. */
function groupFor(tags: string[], doc: Document, bySpec: boolean): string {
  if (bySpec) {
    const declared = doc.tags.map((t) => t.name);
    const hit = declared.find((d) => tags.includes(d));
    return hit ?? 'Other';
  }
  return tags[0] ?? 'Other';
}

/** Every space-separated term must match one of the item's search strings. */
export function matches(item: NavItem, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t !== '');
  if (terms.length === 0) return true;
  return terms.every((term) => item.search.some((s) => s.includes(term)));
}

export interface FilteredNav {
  items: NavItem[];
  /** Operations shown and total, for the live region. */
  shown: number;
  total: number;
  active: boolean;
}

export function filterNav(items: NavItem[], query: string, keepSections: boolean): FilteredNav {
  const active = query.trim() !== '';
  const total = items.filter((i) => i.kind === 'operation').length;
  if (!active) return { items, shown: total, total, active };
  const out = items.filter((i) => (i.kind === 'operation' ? matches(i, query) : keepSections));
  return { items: out, shown: out.filter((i) => i.kind === 'operation').length, total, active };
}

/** Consecutive items with the same group form one block; `undefined` groups are flat. */
export function groupNav(items: NavItem[]): Array<{ group: string | undefined; items: NavItem[] }> {
  const out: Array<{ group: string | undefined; items: NavItem[] }> = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
}
