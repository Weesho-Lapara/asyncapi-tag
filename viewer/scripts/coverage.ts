/**
 * Coverage gate (ROADMAP amendment 5): run the normaliser over the AsyncAPI example corpus
 * plus our own fixtures and write test/coverage/REPORT.md.
 *
 *   npm run coverage            # clones or updates the corpus, then reports
 *   npm run coverage -- --offline   # skip the clone/update (use the cached corpus)
 *
 * The corpus is the examples/ folder of github.com/asyncapi/spec, sparse-cloned into
 * test/coverage/corpus/ (ignored by git). The report is committed and reviewed by hand.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseText, type FetchLike } from '../src/load/loader.js';
import { RefResolver } from '../src/load/refs.js';
import { checkDocument } from '../src/model/invariants.js';
import { normalize } from '../src/model/normalize.js';
import type { Document, Problem } from '../src/model/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const viewerDir = resolve(here, '..');
const repoDir = resolve(viewerDir, '..');
const coverageDir = join(viewerDir, 'test', 'coverage');
const reportPath = join(coverageDir, 'REPORT.md');
const offline = process.argv.includes('--offline');

const SPEC_REPO = 'https://github.com/asyncapi/spec.git';
/** The corpus: the examples/ folder at the spec's main branch (v3) and at the last v2 tag. */
const CORPORA: Array<{ name: string; ref: string; dir: string }> = [
  { name: 'asyncapi/spec examples (master)', ref: 'master', dir: join(coverageDir, 'corpus') },
  { name: 'asyncapi/spec examples (v2.6.0)', ref: 'v2.6.0', dir: join(coverageDir, 'corpus-v2') },
];

function sh(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

function updateCorpus(ref: string, dir: string): string {
  if (!existsSync(join(dir, '.git'))) {
    mkdirSync(dirname(dir), { recursive: true });
    sh('git', ['clone', '--depth', '1', '--branch', ref, '--filter=blob:none', '--sparse', SPEC_REPO, dir], viewerDir);
    sh('git', ['sparse-checkout', 'set', 'examples'], dir);
  } else if (!offline && ref === 'master') {
    sh('git', ['pull', '--ff-only', '--depth', '1'], dir);
  }
  return sh('git', ['rev-parse', '--short', 'HEAD'], dir);
}

/** Absolute file URLs and paths make the report machine-specific; show them relative to the repo. */
function portable(text: string): string {
  return text.split(pathToFileURL(repoDir).href).join('<repo>').split(repoDir).join('<repo>');
}

function listDocuments(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listDocuments(full));
    else if (/\.(ya?ml|json)$/i.test(entry)) out.push(full);
  }
  return out.sort();
}

/** Serves file: URLs from disk and http(s) from the network with a timeout. */
const fetchAny: FetchLike = async (url) => {
  if (url.startsWith('file:')) {
    try {
      const text = readFileSync(fileURLToPath(url), 'utf8');
      return { ok: true, status: 200, text: async () => text };
    } catch {
      return { ok: false, status: 404, text: async () => '' };
    }
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  return { ok: response.ok, status: response.status, text: () => response.text() };
};

interface Row {
  file: string;
  outcome: 'ok' | 'skipped' | 'failed';
  specVersion?: string;
  counts?: { servers: number; operations: number; messages: number; schemas: number; opMessages: number; payloadless: number; raw: number };
  problems: Problem[];
  violations: string[];
  note?: string;
}

async function run(file: string, label: string): Promise<Row> {
  const text = readFileSync(file, 'utf8');
  const parsed = parseText(text);
  if ('error' in parsed) {
    return { file: label, outcome: parsed.error.kind === 'not-object' ? 'skipped' : 'failed', problems: [], violations: [], note: parsed.error.message };
  }
  const raw = parsed.data['asyncapi'];
  if (raw === undefined) return { file: label, outcome: 'skipped', problems: [], violations: [], note: 'not an AsyncAPI document (no "asyncapi" field)' };
  const specVersion = String(raw);
  const major = Number(specVersion.split('.')[0]);
  if (major !== 2 && major !== 3) {
    return { file: label, outcome: 'skipped', specVersion, problems: [], violations: [], note: `AsyncAPI ${specVersion} is not supported` };
  }
  const url = pathToFileURL(file).href;
  const resolver = new RefResolver(url, parsed.data, fetchAny);
  let doc: Document;
  try {
    const preload = await resolver.preload();
    doc = normalize({ resolver, data: parsed.data, specVersion, specMajor: major, problems: preload });
  } catch (e) {
    return { file: label, outcome: 'failed', specVersion, problems: [], violations: [], note: `threw: ${e instanceof Error ? e.stack ?? e.message : String(e)}` };
  }
  return {
    file: label,
    outcome: 'ok',
    specVersion,
    counts: {
      servers: doc.servers.length,
      operations: doc.operations.length,
      messages: doc.messages.length,
      schemas: doc.schemas.length,
      opMessages: doc.operations.reduce((n, op) => n + op.messages.length, 0),
      payloadless: allMessages(doc).filter((m) => m.payload === undefined).length,
      raw: allMessages(doc).filter((m) => m.payload?.kind === 'raw').length,
    },
    problems: doc.problems,
    violations: checkDocument(doc),
  };
}

/** Every distinct message: component messages plus inline ones reached through operations. */
function allMessages(doc: Document): Document['messages'] {
  return [...new Set([...doc.messages, ...doc.operations.flatMap((op) => op.messages)])];
}

function md(s: string): string {
  return portable(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function main(): Promise<void> {
  const shas = CORPORA.map((c) => `${c.ref} \`${updateCorpus(c.ref, c.dir)}\``);
  const sets: Array<[name: string, dir: string]> = [
    ...CORPORA.map((c): [string, string] => [c.name, join(c.dir, 'examples')]),
    ['docs/examples', join(repoDir, 'docs', 'examples')],
    ['viewer/test/fixtures/docs', join(viewerDir, 'test', 'fixtures', 'docs')],
  ];
  const rows: Array<[set: string, row: Row]> = [];
  for (const [name, dir] of sets) {
    for (const file of listDocuments(dir)) rows.push([name, await run(file, relative(dir, file))]);
  }

  const ok = rows.filter(([, r]) => r.outcome === 'ok');
  const withProblems = ok.filter(([, r]) => r.problems.length > 0);
  const withViolations = ok.filter(([, r]) => r.violations.length > 0);
  const failed = rows.filter(([, r]) => r.outcome === 'failed');
  const skipped = rows.filter(([, r]) => r.outcome === 'skipped');

  const lines: string[] = [];
  lines.push('# Coverage report');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`npm run coverage\` against the examples/ folder of asyncapi/spec at ${shas.join(' and ')}, plus our own example documents and fixtures.`);
  lines.push('Review this file by hand after each run; chunk 1.8b of the roadmap fixes what it shows.');
  lines.push('');
  lines.push('| | Count |');
  lines.push('|---|---|');
  lines.push(`| Documents | ${rows.length} |`);
  lines.push(`| Normalised | ${ok.length} |`);
  lines.push(`| With problems | ${withProblems.length} |`);
  lines.push(`| With invariant violations | ${withViolations.length} |`);
  lines.push(`| Failed (threw or unparsable) | ${failed.length} |`);
  lines.push(`| Skipped (not AsyncAPI 2 or 3) | ${skipped.length} |`);
  lines.push('');

  const problemKinds = new Map<string, number>();
  for (const [, r] of ok) {
    for (const p of r.problems) {
      const kind = p.message.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N');
      problemKinds.set(kind, (problemKinds.get(kind) ?? 0) + 1);
    }
  }
  lines.push('## Problem kinds');
  lines.push('');
  lines.push('| Count | Message (values elided) |');
  lines.push('|---|---|');
  for (const [kind, count] of [...problemKinds.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${count} | ${md(kind)} |`);
  if (problemKinds.size === 0) lines.push('| 0 | none |');
  lines.push('');

  lines.push('## Documents');
  lines.push('');
  lines.push('Ops msgs: messages reached through operations. No payload: messages without a payload schema. Raw: messages whose payload is not JSON Schema (shown as a code block).');
  lines.push('');
  lines.push('| Set | Document | Version | Servers | Ops | Ops msgs | Component msgs | No payload | Raw | Schemas | Problems | Violations |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [set, r] of rows) {
    const c = r.counts;
    const cells = c ? [c.servers, c.operations, c.opMessages, c.messages, c.payloadless || '', c.raw || '', c.schemas] : ['', '', '', '', '', '', ''];
    const status = r.outcome === 'ok' ? `${r.problems.length}` : r.outcome;
    lines.push(`| ${set} | ${md(r.file)} | ${r.specVersion ?? ''} | ${cells.join(' | ')} | ${status} | ${r.violations.length || ''} |`);
  }
  lines.push('');

  if (failed.length + skipped.length > 0) {
    lines.push('## Failed and skipped');
    lines.push('');
    for (const [set, r] of [...failed, ...skipped]) lines.push(`- **${set} / ${md(r.file)}**: ${r.outcome}: ${md(r.note ?? '')}`);
    lines.push('');
  }

  lines.push('## Problems and violations per document');
  lines.push('');
  for (const [set, r] of ok) {
    if (r.problems.length === 0 && r.violations.length === 0) continue;
    lines.push(`### ${set} / ${r.file}`);
    lines.push('');
    for (const v of r.violations) lines.push(`- invariant: ${md(v)}`);
    for (const p of r.problems) lines.push(`- ${p.severity} at \`${md(p.where)}\`: ${md(p.message)}`);
    lines.push('');
  }

  writeFileSync(reportPath, lines.join('\n'));
  console.log(`${rows.length} documents, ${ok.length} normalised, ${withProblems.length} with problems, ${withViolations.length} with violations, ${failed.length} failed, ${skipped.length} skipped`);
  console.log(`report: ${relative(process.cwd(), reportPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
