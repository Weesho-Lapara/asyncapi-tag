/**
 * Loads an AsyncAPI document: fetch as text, parse as JSON if that works, otherwise YAML,
 * and check that the result looks like an AsyncAPI document of a supported major version.
 *
 * Failures never throw. They come back as a `LoadFailure` naming the URL and the reason, which
 * the element renders in place so a viewer is never an empty box.
 */
import { parse as parseYaml, YAMLParseError } from 'yaml';

export type LoadErrorKind =
  | 'network' // fetch threw: offline, CORS, DNS, mixed content
  | 'http' // response status outside 200-299
  | 'empty' // body has no content
  | 'parse' // neither JSON nor YAML
  | 'not-object' // parsed, but the root is not a mapping
  | 'unsupported'; // missing or unsupported `asyncapi` version

export interface LoadError {
  kind: LoadErrorKind;
  /** One sentence, no URL (the URL is beside it). */
  message: string;
  status?: number;
}

export interface LoadSuccess {
  ok: true;
  url: string;
  /** The document exactly as served, for "Download spec". */
  text: string;
  format: 'json' | 'yaml';
  /** The parsed root object. */
  data: Record<string, unknown>;
  /** Exact `asyncapi` field, e.g. "2.6.0". */
  specVersion: string;
  specMajor: 2 | 3;
}

export interface LoadFailure {
  ok: false;
  url: string;
  error: LoadError;
}

export type LoadResult = LoadSuccess | LoadFailure;

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Resolve `src` against a base (normally `document.baseURI`); returns `src` unchanged if that fails. */
export function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

export async function loadDocument(url: string, fetchImpl: FetchLike = (u) => fetch(u)): Promise<LoadResult> {
  let status: number;
  let text: string;
  try {
    const response = await fetchImpl(url);
    status = response.status;
    if (!response.ok) {
      return fail(url, { kind: 'http', status, message: `The server answered with HTTP ${status}.` });
    }
    text = await response.text();
  } catch (e) {
    return fail(url, { kind: 'network', message: `The request failed (${describe(e)}).` });
  }
  const parsed = parseText(text);
  if ('error' in parsed) return fail(url, parsed.error);
  const version = detectVersion(parsed.data);
  if ('error' in version) return fail(url, version.error);
  return { ok: true, url, text, format: parsed.format, data: parsed.data, ...version };
}

/** JSON first, then YAML. Exported for tests and for future build-time validation. */
export function parseText(
  text: string,
): { format: 'json' | 'yaml'; data: Record<string, unknown> } | { error: LoadError } {
  if (text.trim() === '') return { error: { kind: 'empty', message: 'The document is empty.' } };
  let data: unknown;
  let format: 'json' | 'yaml';
  try {
    data = JSON.parse(text);
    format = 'json';
  } catch {
    try {
      data = parseYaml(text, { prettyErrors: true });
      format = 'yaml';
    } catch (e) {
      const reason = e instanceof YAMLParseError ? e.message.split('\n')[0] : describe(e);
      return { error: { kind: 'parse', message: `The document is neither valid JSON nor valid YAML: ${reason}` } };
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { error: { kind: 'not-object', message: 'The document root must be an object with an "asyncapi" field.' } };
  }
  return { format, data: data as Record<string, unknown> };
}

export function detectVersion(data: Record<string, unknown>): { specVersion: string; specMajor: 2 | 3 } | { error: LoadError } {
  const raw = data['asyncapi'];
  if (raw === undefined) {
    return { error: { kind: 'unsupported', message: 'The document has no "asyncapi" field, so it is not an AsyncAPI document.' } };
  }
  const specVersion = String(raw);
  const major = Number(specVersion.split('.')[0]);
  if (major === 2 || major === 3) return { specVersion, specMajor: major };
  return { error: { kind: 'unsupported', message: `AsyncAPI ${specVersion} is not supported; this viewer renders AsyncAPI 2 and 3.` } };
}

function fail(url: string, error: LoadError): LoadFailure {
  return { ok: false, url, error };
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
