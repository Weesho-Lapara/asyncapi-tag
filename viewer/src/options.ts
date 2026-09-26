/**
 * Reads and validates element attributes against options.schema.json.
 *
 * Mirrors the Python extension: names are case-insensitive, kebab-case and the lowercased form
 * are both accepted, booleans follow the same table, enum values match case-insensitively,
 * unknown attributes and invalid values produce one warning each and are skipped, and the
 * remaining attributes still apply.
 */
import schema from './options.schema.json';

export type GroupServers = 'byDefault' | 'bySpecTags' | 'byServersTags';
export type GroupOperations = 'byDefault' | 'bySpecTags' | 'byOperationsTags';
export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Options {
  src?: string;
  id?: string;
  sidebar: boolean;
  info: boolean;
  servers: boolean;
  operations: boolean;
  messages: boolean;
  schemas: boolean;
  errors: boolean;
  showMessageExamples: boolean;
  messageExamples: boolean;
  showServers: GroupServers;
  showOperations: GroupOperations;
  useChannelAddressAsIdentifier: boolean;
  publishLabel: string;
  subscribeLabel: string;
  sendLabel: string;
  receiveLabel: string;
  requestLabel: string;
  replyLabel: string;
  parserOptions: { applyTraits: boolean };
  theme: ThemeMode;
  themeToggle: boolean;
  searchKeepSections: boolean;
}

export type OptionType = 'string' | 'boolean' | 'enum' | 'json';
export type OptionStatus = 'active' | 'deprecated-noop';

export interface OptionSpec {
  name: string;
  type: OptionType;
  default?: unknown;
  required?: boolean;
  values?: string[];
  keys?: Record<string, 'boolean' | 'string' | 'number'>;
  status: OptionStatus;
  specVersions: number[];
  description: string;
}

export const OPTION_SPECS: readonly OptionSpec[] = (schema as { options: OptionSpec[] }).options;

/** Defaults derived from the schema; `src`, `id` and deprecated options have none. */
export const DEFAULTS: Readonly<Options> = Object.freeze(
  Object.fromEntries(
    OPTION_SPECS.filter((o) => o.status === 'active' && o.default !== null && o.default !== undefined).map((o) => [
      o.name,
      structuredClone(o.default),
    ]),
  ) as unknown as Options,
);

const TRUE = new Set(['true', '1', 'yes', 'on']);
const FALSE = new Set(['false', '0', 'no', 'off']);

/** Attribute names that belong to HTML, not to us: never warned about. */
const HTML_GLOBAL = new Set([
  'class', 'style', 'slot', 'hidden', 'title', 'lang', 'dir', 'role', 'tabindex', 'part', 'exportparts', 'translate', 'nonce',
]);

/** Canonical option name from any accepted spelling: `sendLabel`, `send-label`, `sendlabel`, `SEND-LABEL`. */
const BY_KEY = new Map(OPTION_SPECS.map((o) => [o.name.toLowerCase(), o]));
export function lookupOption(attribute: string): OptionSpec | undefined {
  return BY_KEY.get(attribute.replace(/-/g, '').toLowerCase());
}

/** `sendLabel` -> `send-label`: the form the Python side emits. */
export function toAttributeName(option: string): string {
  return option.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export type WarnFn = (message: string) => void;

const PREFIX = '<asyncapi-viewer>:';

/**
 * Build Options from attributes. `attrs` is any iterable of `[name, value]`; a `null` value is a
 * bare attribute. `src` and `id` pass through untouched.
 */
export function parseOptions(
  attrs: Iterable<readonly [string, string | null]>,
  warn: WarnFn = (m) => console.warn(m),
): Options {
  const out = structuredClone(DEFAULTS) as Options;
  const slot = out as unknown as Record<string, unknown>;
  for (const [rawName, raw] of attrs) {
    const name = rawName.toLowerCase();
    if (HTML_GLOBAL.has(name) || name.startsWith('data-') || name.startsWith('aria-') || name.startsWith('on')) continue;
    const spec = lookupOption(name);
    if (!spec) {
      warn(`${PREFIX} unknown attribute '${rawName}' was ignored.`);
      continue;
    }
    if (spec.status === 'deprecated-noop') {
      warn(`${PREFIX} attribute '${rawName}' is deprecated and does nothing.`);
      continue;
    }
    if (spec.name === 'src' || spec.name === 'id') {
      if (raw !== null && raw !== '') slot[spec.name] = raw;
      continue;
    }
    const value = coerce(spec, rawName, raw, warn);
    if (value !== INVALID) slot[spec.name] = value;
  }
  return out;
}

const INVALID = Symbol('invalid');

function coerce(spec: OptionSpec, rawName: string, raw: string | null, warn: WarnFn): unknown {
  switch (spec.type) {
    case 'boolean': {
      // A bare attribute reads as null from a parser and as "" from the DOM; both mean true.
      const text = raw === null || raw.trim() === '' ? 'true' : raw.trim().toLowerCase();
      if (TRUE.has(text)) return true;
      if (FALSE.has(text)) return false;
      warn(`${PREFIX} attribute '${rawName}' expects true or false, got '${raw}'.`);
      return INVALID;
    }
    case 'enum': {
      const wanted = (raw ?? '').trim().toLowerCase();
      const match = spec.values?.find((v) => v.toLowerCase() === wanted);
      if (match !== undefined) return match;
      warn(`${PREFIX} attribute '${rawName}' expects one of ${spec.values?.join(', ')}; got '${raw}'.`);
      return INVALID;
    }
    case 'json': {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw ?? '');
      } catch (e) {
        warn(`${PREFIX} attribute '${rawName}' is not valid JSON (${(e as Error).message}).`);
        return INVALID;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        warn(`${PREFIX} attribute '${rawName}' expects a JSON object, got ${JSON.stringify(parsed)}.`);
        return INVALID;
      }
      const result = structuredClone(spec.default) as Record<string, unknown>;
      for (const [key, v] of Object.entries(parsed as Record<string, unknown>)) {
        const expected = spec.keys?.[key];
        if (!expected) {
          warn(`${PREFIX} ${spec.name}.${key} is not supported and was ignored.`);
        } else if (typeof v !== expected) {
          warn(`${PREFIX} ${spec.name}.${key} expects a ${expected}, got ${JSON.stringify(v)}.`);
        } else {
          result[key] = v;
        }
      }
      return result;
    }
    case 'string':
      return raw ?? '';
  }
}
