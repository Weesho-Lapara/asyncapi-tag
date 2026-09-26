/**
 * Copy the AsyncAPI spec examples (fetched by `npm run coverage` into test/coverage/corpus)
 * into demo/spec-examples/ and write demo/spec-examples/index.json, the list the demo page's
 * dropdown is built from. The whole examples tree is copied verbatim so relative $refs keep
 * working; only files that are AsyncAPI documents appear in the manifest.
 *
 *   npm run sync-examples
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseText } from '../src/load/loader.js';

const viewerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = join(viewerDir, 'test', 'coverage', 'corpus');
const source = join(corpus, 'examples');
const target = join(viewerDir, 'demo', 'spec-examples');

if (!existsSync(source)) {
  console.error('Corpus not found. Run `npm run coverage` first (it clones asyncapi/spec examples).');
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: corpus, encoding: 'utf8' }).trim();
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ya?ml|json)$/i.test(entry)) files.push(full);
  }
};
walk(target);

const documents = files
  .map((file) => {
    const parsed = parseText(readFileSync(file, 'utf8'));
    if ('error' in parsed || parsed.data['asyncapi'] === undefined) return undefined;
    const info = (parsed.data['info'] ?? {}) as Record<string, unknown>;
    return {
      path: relative(target, file).split('\\').join('/'),
      title: typeof info['title'] === 'string' ? info['title'] : relative(target, file),
      version: typeof info['version'] === 'string' ? info['version'] : '',
      asyncapi: String(parsed.data['asyncapi']),
    };
  })
  .filter((d): d is NonNullable<typeof d> => d !== undefined)
  .sort((a, b) => a.title.localeCompare(b.title));

writeFileSync(
  join(target, 'index.json'),
  JSON.stringify({ source: 'https://github.com/asyncapi/spec/tree/master/examples', commit: sha, documents }, null, 2) + '\n',
);
writeFileSync(
  join(target, 'README.md'),
  `# AsyncAPI spec examples\n\nVerbatim copy of the examples/ folder of https://github.com/asyncapi/spec (Apache-2.0),\ncommit ${sha}, made by \`npm run sync-examples\` for the demo page's document list. Do not edit;\nrerun the script to update. index.json lists the documents (files without an \`asyncapi\` field\nare shared components referenced by others).\n`,
);
console.log(`${documents.length} documents from ${files.length} files at ${sha.slice(0, 7)} -> demo/spec-examples/`);
