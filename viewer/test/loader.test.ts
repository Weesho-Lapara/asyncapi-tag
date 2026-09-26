import { describe, expect, it } from 'vitest';
import accountsJson from '../../docs/examples/accounts-v2.json?raw';
import ordersYaml from '../../docs/examples/orders-v3.yaml?raw';
import { detectVersion, loadDocument, parseText, resolveUrl, type FetchLike } from '../src/load/loader.js';

function serve(files: Record<string, string | number | Error>): FetchLike {
  return async (url) => {
    const entry = files[url];
    if (entry === undefined) return { ok: false, status: 404, text: async () => 'Not found' };
    if (entry instanceof Error) throw entry;
    if (typeof entry === 'number') return { ok: false, status: entry, text: async () => '' };
    return { ok: true, status: 200, text: async () => entry };
  };
}

describe('loadDocument', () => {
  const fetchImpl = serve({
    'https://x.test/orders.yaml': ordersYaml,
    'https://x.test/accounts.json': accountsJson,
    'https://x.test/broken.yaml': 'asyncapi: 3.0.0\ninfo:\n  title: [unclosed\n',
    'https://x.test/empty.yaml': '   \n',
    'https://x.test/scalar.yaml': 'just a string',
    'https://x.test/list.json': '[1, 2]',
    'https://x.test/old.yaml': 'asyncapi: 1.2.0\ninfo: {title: Old}\n',
    'https://x.test/openapi.json': '{"openapi": "3.1.0"}',
    'https://x.test/teapot.json': 418,
    'https://x.test/offline.json': new TypeError('Failed to fetch'),
  });

  it('parses YAML and reports the version', async () => {
    const r = await loadDocument('https://x.test/orders.yaml', fetchImpl);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ format: 'yaml', specVersion: '3.0.0', specMajor: 3, text: ordersYaml });
    expect((r.data['info'] as { title: string }).title).toBe('Orders service');
  });

  it('parses JSON before trying YAML', async () => {
    const r = await loadDocument('https://x.test/accounts.json', fetchImpl);
    expect(r.ok && r.format).toBe('json');
    expect(r.ok && r.specMajor).toBe(2);
  });

  it.each([
    ['https://x.test/missing.yaml', 'http', /HTTP 404/],
    ['https://x.test/teapot.json', 'http', /HTTP 418/],
    ['https://x.test/offline.json', 'network', /Failed to fetch/],
    ['https://x.test/empty.yaml', 'empty', /empty/],
    ['https://x.test/broken.yaml', 'parse', /neither valid JSON nor valid YAML/],
    ['https://x.test/scalar.yaml', 'not-object', /root must be an object/],
    ['https://x.test/list.json', 'not-object', /root must be an object/],
    ['https://x.test/old.yaml', 'unsupported', /AsyncAPI 1\.2\.0 is not supported/],
    ['https://x.test/openapi.json', 'unsupported', /no "asyncapi" field/],
  ])('%s fails with kind %s', async (url, kind, message) => {
    const r = await loadDocument(url, fetchImpl);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.url).toBe(url);
    expect(r.error.kind).toBe(kind);
    expect(r.error.message).toMatch(message);
  });

  it('keeps the HTTP status on http failures', async () => {
    const r = await loadDocument('https://x.test/teapot.json', fetchImpl);
    expect(!r.ok && r.error.status).toBe(418);
  });

  it('YAML parse errors name the line', () => {
    const r = parseText('asyncapi: 3.0.0\ninfo:\n  title: [unclosed\n');
    expect('error' in r && r.error.message).toMatch(/at line \d+, column \d+/);
  });
});

describe('detectVersion', () => {
  it('accepts numbers and strings, rejects everything else', () => {
    expect(detectVersion({ asyncapi: '2.0.0' })).toEqual({ specVersion: '2.0.0', specMajor: 2 });
    expect(detectVersion({ asyncapi: 3 })).toEqual({ specVersion: '3', specMajor: 3 });
    expect('error' in detectVersion({ asyncapi: '4.0.0' })).toBe(true);
    expect('error' in detectVersion({ asyncapi: 'three' })).toBe(true);
  });
});

describe('resolveUrl', () => {
  it('resolves relative to the page and passes through what it cannot resolve', () => {
    expect(resolveUrl('../examples/a.yaml', 'https://docs.test/guide/page/')).toBe('https://docs.test/guide/examples/a.yaml');
    expect(resolveUrl('/abs.yaml', 'https://docs.test/guide/')).toBe('https://docs.test/abs.yaml');
    expect(resolveUrl('a.yaml', 'not a url')).toBe('a.yaml');
  });
});
