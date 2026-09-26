// Public entry point: defines the <asyncapi-viewer> element and re-exports the model types.
export { AsyncAPIViewerElement } from './element.js';
export type * from './model/types.js';
export { parseOptions, DEFAULTS, OPTION_SPECS, toAttributeName } from './options.js';
export type { Options } from './options.js';
export { loadDocument, parseText, resolveUrl } from './load/loader.js';
export type { LoadResult, LoadError } from './load/loader.js';
export { RefResolver, isRef, schemaNameOf } from './load/refs.js';
export type { Resolved, Dereferenced, ResolveFailure } from './load/refs.js';
export { normalize } from './model/normalize.js';
export type { NormalizeInput } from './model/normalize.js';
export { checkDocument } from './model/invariants.js';
