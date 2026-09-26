/**
 * The normalised model.
 *
 * One shape for AsyncAPI 2 and 3. The normalisers (model/v2.ts, model/v3.ts) are the only code
 * that knows spec field names; the render layer, the theme and the Python search fallback all
 * work from this model. The UI may branch on `specMajor` only where specs/viewer-spec.md 3.4
 * allows it: parameter `schemaType` (v2), server host display, and the header badge.
 *
 * Conventions:
 * - Arrays are always present (possibly empty); optional scalars are absent, never null,
 *   with one exception: `Channel.address` is `null` when the document leaves it unset.
 * - `id` is the key in the source document. `anchor` is the sanitised, document-unique slug used
 *   in page anchors `#<element id>--<section>--<anchor>` (ROADMAP amendment 10). The element id is
 *   not part of the model, so several viewers on one page can share a model.
 * - Text marked "markdown" is rendered through markdown-it with HTML disabled. Nothing in the
 *   model is ever inserted as HTML.
 * - Authored examples only. Generated examples (ROADMAP amendment 9) are produced from a
 *   `SchemaNode` at render time and never stored in the model, so snapshots stay stable.
 */

export type SpecMajor = 2 | 3;

export type SectionId = 'info' | 'servers' | 'operations' | 'messages' | 'schemas' | 'problems';

export interface Document {
  /** Exact version string from the document, e.g. "3.0.0" or "2.6.0". */
  specVersion: string;
  /** The only version switch the UI may use (spec 3.4). */
  specMajor: SpecMajor;
  title: string;
  version: string;
  /** markdown */
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
  externalDocs?: ExternalDocs;
  /** Document-level tags: v3 `info.tags`, v2 root `tags`. Drive `bySpecTags` grouping. */
  tags: Tag[];
  defaultContentType?: string;
  servers: Server[];
  operations: Operation[];
  /** `components.messages`, in document order. */
  messages: Message[];
  /** `components.schemas`, in document order. */
  schemas: NamedSchema[];
  /** Anything skipped or suspicious. Rendered by the Problems section when `errors` is on. */
  problems: Problem[];
}

export interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

export interface License {
  name: string;
  url?: string;
}

export interface ExternalDocs {
  url: string;
  /** markdown */
  description?: string;
}

export interface Tag {
  name: string;
  /** markdown */
  description?: string;
  externalDocs?: ExternalDocs;
}

export interface Server {
  id: string;
  anchor: string;
  title?: string;
  summary?: string;
  /** markdown */
  description?: string;
  protocol: string;
  protocolVersion?: string;
  /** v3: `host` + `pathname`; v2: `url`. Shown as is. */
  hostDisplay: string;
  variables: ServerVariable[];
  security: SecurityRequirement[];
  tags: Tag[];
  externalDocs?: ExternalDocs;
  bindings: Binding[];
}

export interface ServerVariable {
  name: string;
  /** markdown */
  description?: string;
  enum?: string[];
  default?: string;
  examples?: string[];
}

/** The application's side of the channel. v2 `publish` normalises to `receive`, `subscribe` to `send`. */
export type OperationAction = 'send' | 'receive';

/** `request` and `reply` are v3 operations that carry a `reply`; the badge label follows `kind`. */
export type OperationKind = 'send' | 'receive' | 'request' | 'reply';

export interface Operation {
  /** v3: the operation key. v2: `operationId`, else `<publish|subscribe>-<channel key>`. */
  id: string;
  anchor: string;
  /** v3: `title`, else id; with `useChannelAddressAsIdentifier` the channel address. v2: id. */
  heading: string;
  action: OperationAction;
  kind: OperationKind;
  /** Resolved from the label options at normalisation time (e.g. "SEND", "PUB"). */
  badgeLabel: string;
  /** Small mono line above the heading. v3: operation key; v2: `channels › <key> › <publish|subscribe>`. */
  locationHint: string;
  channel: Channel;
  summary?: string;
  /** markdown */
  description?: string;
  tags: Tag[];
  externalDocs?: ExternalDocs;
  /** The messages this operation may carry. Several means a tab row in the UI. */
  messages: Message[];
  reply?: Reply;
  security: SecurityRequirement[];
  bindings: Binding[];
}

export interface Channel {
  /** v3: the channel key. v2: the channel key, which is also the address. */
  id: string;
  /** `null` when the document does not set one (v3 only). UI shows "Address not specified". */
  address: string | null;
  title?: string;
  summary?: string;
  /** markdown */
  description?: string;
  parameters: Parameter[];
  /** Server ids this channel is available on. Empty means all servers. */
  servers: string[];
  tags: Tag[];
  externalDocs?: ExternalDocs;
  bindings: Binding[];
}

export interface Parameter {
  name: string;
  /** markdown */
  description?: string;
  enum?: string[];
  default?: string;
  examples?: string[];
  location?: string;
  /** v2 only: the parameter schema's type (spec 3.4). */
  schemaType?: string;
}

export interface Reply {
  /** Static reply channel, when the document declares one. */
  channel?: Channel;
  /** Dynamic reply address (`address.location`), when the document declares one instead. */
  addressLocation?: string;
  /** markdown; description of the dynamic address */
  addressDescription?: string;
  /** Reply messages as compact references to their definitions. */
  messages: MessageRef[];
}

export interface MessageRef {
  id: string;
  anchor: string;
  name?: string;
  title?: string;
}

export interface Message {
  /** The `components.messages` key, or the channel-level message key for inline messages. */
  id: string;
  anchor: string;
  name?: string;
  title?: string;
  summary?: string;
  /** markdown */
  description?: string;
  /** Resolved: message `contentType`, else document `defaultContentType`, else "application/json". */
  contentType: string;
  /** Resolved: message `schemaFormat`, else the default for the spec version. */
  schemaFormat: string;
  payload?: Schema;
  headers?: Schema;
  correlationId?: CorrelationId;
  /** Authored examples only (v2.2+ and v3). See the file comment on generated examples. */
  examples: MessageExample[];
  tags: Tag[];
  externalDocs?: ExternalDocs;
  bindings: Binding[];
}

export interface CorrelationId {
  location: string;
  /** markdown */
  description?: string;
}

export interface MessageExample {
  name?: string;
  summary?: string;
  /** Parsed value from the document, rendered as JSON. */
  payload?: unknown;
  headers?: unknown;
}

/** A payload or headers schema: either a tree we understand, or a raw block we only display. */
export type Schema = SchemaNode | RawSchema;

/** Non-JSON-Schema formats (Avro, Protobuf, RAML, ...): shown as a labelled code block. */
export interface RawSchema {
  kind: 'raw';
  schemaFormat: string;
  /** The schema exactly as written, serialised to text if it was an object. */
  source: string;
}

export interface SchemaNode {
  kind: 'node';
  /**
   * Property name. Root nodes use "" (payload, headers) or the schema key (components.schemas).
   * The item schema of an array is a child named "[]".
   */
  name: string;
  /**
   * Display path, one segment per level, excluding the root and this node, so a root always has
   * `[]`. The item node of an array has the array's name as its last segment and contributes no
   * segment of its own: its children start with `"items[]"` instead, so a node three levels under
   * an array reads `["items[]", "customisation", "engraving"]` (spec 4.8 path line).
   */
  path: string[];
  /** JSON Schema `type` as a list: `["string"]`, `["string", "null"]`; empty when untyped. */
  types: string[];
  format?: string;
  /** From the parent's `required` array. Always false on root nodes. */
  required: boolean;
  title?: string;
  /** markdown */
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  /** min/max, length, pattern and friends, in a stable display order. */
  constraints: Constraint[];
  /** Object properties, or the single "[]" item node for arrays. Empty for leaves. */
  children: SchemaNode[];
  /** `oneOf` / `anyOf` variants. `allOf` is merged into `children` and never appears here. */
  composition?: Composition;
  /** Set when this node is a `$ref` to a `components.schemas` entry; links to the Schemas section. */
  refName?: string;
  /**
   * Set instead of children when the node refers back to an ancestor. Names the referenced
   * schema; the UI renders "Circular reference to <name>" with a link.
   */
  circularRef?: string;
}

export interface Composition {
  kind: 'oneOf' | 'anyOf';
  variants: SchemaVariant[];
}

export interface SchemaVariant {
  /** The variant schema's `title`, else "Variant N". */
  title: string;
  node: SchemaNode;
}

export type ConstraintKey =
  | 'minimum'
  | 'exclusiveMinimum'
  | 'maximum'
  | 'exclusiveMaximum'
  | 'multipleOf'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'minItems'
  | 'maxItems'
  | 'uniqueItems'
  | 'minProperties'
  | 'maxProperties';

export interface Constraint {
  key: ConstraintKey;
  value: number | string | boolean;
}

export interface NamedSchema {
  /** The `components.schemas` key. */
  id: string;
  anchor: string;
  schema: Schema;
}

export type BindingScope = 'server' | 'channel' | 'operation' | 'message';

/**
 * One chip: `<scope>.<key> <value>`, e.g. `channel.partitions 12`. `bindingVersion` is emitted as
 * a binding of its own so new binding fields need no code changes.
 */
export interface Binding {
  scope: BindingScope;
  protocol: string;
  key: string;
  value: unknown;
}

/** A resolved security requirement: the scheme inlined, plus the scopes requested. */
export interface SecurityRequirement {
  /** The `components.securitySchemes` key. */
  id: string;
  type: string;
  /** markdown */
  description?: string;
  scopes: string[];
}

export type ProblemSeverity = 'error' | 'warning';

export interface Problem {
  severity: ProblemSeverity;
  /** Plain text, one sentence. */
  message: string;
  /** Where in the source document, as a JSON pointer such as "/channels/orders/messages/0". */
  where: string;
}
