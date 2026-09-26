/**
 * Shared state for one normalisation run: the resolver, the problems list, the label options,
 * anchor allocation and the small helpers every normaliser needs.
 */
import { schemaNameOf, type RefResolver } from '../load/refs.js';
import type { Binding, BindingScope, ExternalDocs, Problem, SectionId, Tag } from './types.js';

export interface Labels {
  publish: string;
  subscribe: string;
  send: string;
  receive: string;
  request: string;
  reply: string;
}

export interface NormalizeOptions {
  labels: Labels;
  useChannelAddressAsIdentifier: boolean;
  applyTraits: boolean;
}

export const DEFAULT_NORMALIZE_OPTIONS: NormalizeOptions = {
  labels: { publish: 'PUB', subscribe: 'SUB', send: 'SEND', receive: 'RECEIVE', request: 'REQUEST', reply: 'REPLY' },
  useChannelAddressAsIdentifier: false,
  applyTraits: true,
};

export type Obj = Record<string, unknown>;

export function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
}

/** A dereferenced object together with where it lives, for nested references. */
export interface Located {
  value: Obj;
  baseUrl: string;
  /** Resolved id when the value came through a `$ref`. */
  id: string | undefined;
}

export class Context {
  readonly problems: Problem[] = [];
  readonly #anchors = new Map<SectionId, Set<string>>();

  constructor(
    readonly resolver: RefResolver,
    readonly options: NormalizeOptions,
  ) {}

  problem(severity: Problem['severity'], message: string, where: string): void {
    this.problems.push({ severity, message, where });
  }

  /**
   * Dereference `value` (following `$ref` chains) and require an object. Anything else is
   * recorded as a problem at `where` and yields undefined.
   */
  object(value: unknown, baseUrl: string, where: string): Located | undefined {
    if (value === undefined) return undefined;
    const r = this.resolver.deref(value, baseUrl);
    if ('error' in r) {
      this.problem('error', r.error, where);
      return undefined;
    }
    if (!isObj(r.value)) {
      this.problem('warning', `Expected an object at "${where}" but found ${describeType(r.value)}; it was skipped.`, where);
      return undefined;
    }
    return { value: r.value, baseUrl: r.baseUrl, id: r.id };
  }

  /** Iterate a map-shaped field (`servers`, `channels`, ...) dereferencing each entry. */
  *entries(map: unknown, baseUrl: string, where: string): Generator<[key: string, located: Located, where: string]> {
    if (map === undefined) return;
    if (!isObj(map)) {
      this.problem('warning', `Expected a map at "${where}"; it was skipped.`, where);
      return;
    }
    for (const [key, raw] of Object.entries(map)) {
      const itemWhere = `${where}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
      const located = this.object(raw, baseUrl, itemWhere);
      if (located) yield [key, located, itemWhere];
    }
  }

  /** Iterate a list field dereferencing each entry. */
  *items(list: unknown, baseUrl: string, where: string): Generator<[located: Located, where: string]> {
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      this.problem('warning', `Expected a list at "${where}"; it was skipped.`, where);
      return;
    }
    for (let i = 0; i < list.length; i++) {
      const itemWhere = `${where}/${i}`;
      const located = this.object(list[i], baseUrl, itemWhere);
      if (located) yield [located, itemWhere];
    }
  }

  /** A document-unique anchor for `id` within a section. */
  anchor(section: SectionId, id: string): string {
    const used = this.#anchors.get(section) ?? new Set<string>();
    this.#anchors.set(section, used);
    const base = id.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^[^A-Za-z0-9]+/, '') || 'item';
    let candidate = base;
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`;
    used.add(candidate);
    return candidate;
  }

  tags(list: unknown, baseUrl: string, where: string): Tag[] {
    const out: Tag[] = [];
    for (const [{ value, baseUrl: b }, w] of this.items(list, baseUrl, where)) {
      const name = str(value['name']);
      if (name === undefined) {
        this.problem('warning', `A tag without a name at "${w}" was skipped.`, w);
        continue;
      }
      const tag: Tag = { name };
      const description = str(value['description']);
      if (description !== undefined) tag.description = description;
      const ext = this.externalDocs(value['externalDocs'], b, `${w}/externalDocs`);
      if (ext) tag.externalDocs = ext;
      out.push(tag);
    }
    return out;
  }

  externalDocs(value: unknown, baseUrl: string, where: string): ExternalDocs | undefined {
    const located = this.object(value, baseUrl, where);
    if (!located) return undefined;
    const url = str(located.value['url']);
    if (url === undefined) {
      this.problem('warning', `externalDocs without a url at "${where}" was skipped.`, where);
      return undefined;
    }
    const out: ExternalDocs = { url };
    const description = str(located.value['description']);
    if (description !== undefined) out.description = description;
    return out;
  }

  /** `bindings: { kafka: { groupId: x, bindingVersion: y } }` -> one Binding per key. */
  bindings(scope: BindingScope, value: unknown, baseUrl: string, where: string): Binding[] {
    const out: Binding[] = [];
    const located = this.object(value, baseUrl, where);
    if (!located) return out;
    for (const [protocol, entry, w] of this.entries(located.value, located.baseUrl, where)) {
      for (const [key, v] of Object.entries(entry.value)) {
        out.push({ scope, protocol, key, value: v });
      }
      void w;
    }
    return out;
  }

  /** The last pointer segment of a resolved id: `#/servers/production` -> `production`. */
  static keyOf(id: string | undefined): string | undefined {
    if (id === undefined) return undefined;
    const pointer = id.slice(id.indexOf('#') + 1);
    const last = pointer.split('/').pop();
    return last === undefined || last === '' ? undefined : last.replace(/~1/g, '/').replace(/~0/g, '~');
  }

  static schemaName(id: string | undefined): string | undefined {
    return id === undefined ? undefined : schemaNameOf(id);
  }
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  return typeof value === 'object' ? 'an object' : `a ${typeof value}`;
}
