/**
 * Entry point: turn a loaded document into the normalised model.
 */
import type { RefResolver } from '../load/refs.js';
import { Context, DEFAULT_NORMALIZE_OPTIONS, type NormalizeOptions } from './context.js';
import type { Document, Problem } from './types.js';
import { normalizeV3 } from './v3.js';

export interface NormalizeInput {
  resolver: RefResolver;
  data: Record<string, unknown>;
  specVersion: string;
  specMajor: 2 | 3;
  /** Problems found earlier (reference preloading) to carry into the document. */
  problems?: Problem[];
  options?: Partial<NormalizeOptions>;
}

export function normalize(input: NormalizeInput): Document {
  const options: NormalizeOptions = { ...DEFAULT_NORMALIZE_OPTIONS, ...input.options, labels: { ...DEFAULT_NORMALIZE_OPTIONS.labels, ...input.options?.labels } };
  const ctx = new Context(input.resolver, options);
  for (const p of input.problems ?? []) ctx.problems.push(p);
  if (input.specMajor === 3) return normalizeV3(ctx, input.data, input.specVersion);
  ctx.problem('error', `AsyncAPI ${input.specVersion} normalisation is not implemented yet.`, '/asyncapi');
  const info = (input.data['info'] ?? {}) as Record<string, unknown>;
  return {
    specVersion: input.specVersion,
    specMajor: 2,
    title: typeof info['title'] === 'string' ? info['title'] : 'Untitled API',
    version: typeof info['version'] === 'string' ? info['version'] : '',
    tags: [],
    servers: [],
    operations: [],
    messages: [],
    schemas: [],
    problems: ctx.problems,
  };
}
