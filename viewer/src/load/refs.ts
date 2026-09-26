/**
 * `$ref` resolution.
 *
 * The normalisers are synchronous, so resolution happens in two steps: `preload()` walks the
 * root document, fetches every external document it references (and theirs, recursively),
 * each exactly once, and records what could not be loaded as problems. After that `resolve()`
 * and `deref()` are synchronous lookups.
 *
 * A reference is `<url>#<json pointer>`. The url part is resolved against the document the
 * reference appears in, so references inside an external file are relative to that file.
 * Reference chains (a `$ref` pointing at another `$ref`) are followed with a cycle guard.
 * Cycles in the schema graph itself are not an error here: the tree builder detects them by
 * tracking resolved ids on its way down.
 */
import type { Problem } from '../model/types.js';
import { parseText, type FetchLike } from './loader.js';

export interface Resolved {
  /** The target value with its own `$ref`s still in place. */
  value: unknown;
  /** Stable identity: `<absolute url>#<pointer>`. Two refs to the same target share an id. */
  id: string;
  /** The document the target lives in; nested references resolve against it. */
  baseUrl: string;
  /** The pointer within that document, e.g. "/components/schemas/Order". */
  pointer: string;
}

export interface ResolveFailure {
  error: string;
}

/** What `deref()` returns: like `Resolved`, but inline values have no id. */
export interface Dereferenced {
  value: unknown;
  id: string | undefined;
  baseUrl: string;
  pointer: string;
}

export function isRef(value: unknown): value is { $ref: string } {
  return typeof value === 'object' && value !== null && typeof (value as { $ref?: unknown }).$ref === 'string';
}

/** `#/components/schemas/Order` -> `Order`; undefined for anything else. */
export function schemaNameOf(id: string): string | undefined {
  const m = /#\/components\/schemas\/([^/]+)$/.exec(id);
  return m ? decodePointerSegment(m[1]!) : undefined;
}

export class RefResolver {
  readonly #docs = new Map<string, Record<string, unknown>>();
  readonly #failed = new Map<string, string>();
  readonly #fetch: FetchLike;
  readonly rootUrl: string;

  constructor(rootUrl: string, rootDoc: Record<string, unknown>, fetchImpl: FetchLike = (u) => fetch(u)) {
    this.rootUrl = stripFragment(rootUrl);
    this.#docs.set(this.rootUrl, rootDoc);
    this.#fetch = fetchImpl;
  }

  /** Fetch every external document reachable through `$ref`s. Returns load problems. */
  async preload(): Promise<Problem[]> {
    const problems: Problem[] = [];
    const queue: string[] = [this.rootUrl];
    const seenRefs = new Set<string>();
    while (queue.length > 0) {
      const url = queue.shift()!;
      const doc = this.#docs.get(url);
      if (!doc) continue;
      for (const [ref, where] of collectRefs(doc)) {
        const target = stripFragment(resolveAgainst(ref, url));
        const key = `${url} ${ref}`;
        if (seenRefs.has(key)) continue;
        seenRefs.add(key);
        if (target === url || this.#docs.has(target) || this.#failed.has(target)) continue;
        const result = await this.#fetchDoc(target);
        if (typeof result === 'string') {
          this.#failed.set(target, result);
          problems.push({ severity: 'error', message: `Could not load "${target}" for $ref "${ref}": ${result}`, where });
        } else {
          this.#docs.set(target, result);
          queue.push(target);
        }
      }
    }
    return problems;
  }

  /** Resolve one reference string as written at `baseUrl`. Synchronous; needs `preload()` first for external refs. */
  resolve(ref: string, baseUrl: string): Resolved | ResolveFailure {
    const absolute = resolveAgainst(ref, baseUrl);
    const hash = absolute.indexOf('#');
    const url = hash === -1 ? absolute : absolute.slice(0, hash);
    const pointer = hash === -1 ? '' : safeDecode(absolute.slice(hash + 1));
    const doc = this.#docs.get(url);
    if (!doc) {
      const reason = this.#failed.get(url) ?? 'the document was not loaded';
      return { error: `Could not resolve $ref "${ref}": ${reason}.` };
    }
    if (pointer !== '' && !pointer.startsWith('/')) {
      return { error: `Could not resolve $ref "${ref}": the fragment is not a JSON pointer.` };
    }
    const value = walkPointer(doc, pointer);
    if (value === MISSING) return { error: `Could not resolve $ref "${ref}": nothing at "${pointer}".` };
    return { value, id: `${url}#${pointer}`, baseUrl: url, pointer };
  }

  /**
   * Follow `$ref` chains from a value until a non-reference is reached. Inline values come back
   * unchanged with the caller's `baseUrl` and no id.
   */
  deref(value: unknown, baseUrl: string): Dereferenced | ResolveFailure {
    let current: unknown = value;
    let base = baseUrl;
    let id: string | undefined;
    let pointer = '';
    const seen = new Set<string>();
    while (isRef(current)) {
      const r = this.resolve(current.$ref, base);
      if ('error' in r) return r;
      if (seen.has(r.id)) return { error: `Circular $ref chain at "${r.id}".` };
      seen.add(r.id);
      ({ value: current, baseUrl: base, id, pointer } = r);
    }
    return { value: current, id, baseUrl: base, pointer };
  }

  /** Every document loaded so far, by absolute URL (the root first). */
  get documents(): ReadonlyMap<string, Record<string, unknown>> {
    return this.#docs;
  }

  async #fetchDoc(url: string): Promise<Record<string, unknown> | string> {
    let text: string;
    try {
      const response = await this.#fetch(url);
      if (!response.ok) return `HTTP ${response.status}`;
      text = await response.text();
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    const parsed = parseText(text);
    return 'error' in parsed ? parsed.error.message : parsed.data;
  }
}

const MISSING = Symbol('missing');

/** Every `$ref` string in a document with the JSON pointer of the object that holds it. */
export function collectRefs(doc: unknown): Array<[ref: string, where: string]> {
  const out: Array<[string, string]> = [];
  const visit = (node: unknown, pointer: string) => {
    if (typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${pointer}/${i}`));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') out.push([value, pointer]);
      else visit(value, `${pointer}/${encodePointerSegment(key)}`);
    }
  };
  visit(doc, '');
  return out;
}

export function walkPointer(doc: unknown, pointer: string): unknown {
  if (pointer === '') return doc;
  let current: unknown = doc;
  for (const rawSegment of pointer.slice(1).split('/')) {
    const segment = decodePointerSegment(rawSegment);
    if (Array.isArray(current)) {
      const index = /^\d+$/.test(segment) ? Number(segment) : -1;
      if (index < 0 || index >= current.length) return MISSING;
      current = current[index];
    } else if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return MISSING;
    }
  }
  return current;
}

export function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function encodePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function resolveAgainst(ref: string, baseUrl: string): string {
  if (ref.startsWith('#')) return `${stripFragment(baseUrl)}${ref}`;
  try {
    return new URL(ref, baseUrl).href;
  } catch {
    return ref;
  }
}

function stripFragment(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

function safeDecode(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}
