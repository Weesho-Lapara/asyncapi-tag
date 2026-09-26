/**
 * AsyncAPI 3 normaliser. The only code that knows v3 field names for info, servers, channels,
 * operations, messages and reply. Traits, security details and bindings edge cases are refined
 * in chunk 1.7; this chunk establishes the shape.
 */
import { Context, isObj, str, type Located, type Obj } from './context.js';
import { buildSchema } from './schema.js';
import type {
  Channel,
  Contact,
  CorrelationId,
  Document,
  Message,
  MessageExample,
  MessageRef,
  Operation,
  OperationKind,
  Parameter,
  Reply,
  SecurityRequirement,
  Server,
  ServerVariable,
} from './types.js';

export function normalizeV3(ctx: Context, root: Obj, specVersion: string): Document {
  const base = ctx.resolver.rootUrl;
  const schemaFormatDefault = `application/vnd.aai.asyncapi+json;version=${specVersion}`;
  const info = ctx.object(root['info'], base, '/info') ?? { value: {}, baseUrl: base, id: undefined };
  if (!isObj(root['info'])) ctx.problem('error', 'The document has no "info" object.', '/info');

  const doc: Document = {
    specVersion,
    specMajor: 3,
    title: str(info.value['title']) ?? 'Untitled API',
    version: str(info.value['version']) ?? '',
    tags: ctx.tags(info.value['tags'], info.baseUrl, '/info/tags'),
    servers: [],
    operations: [],
    messages: [],
    schemas: [],
    problems: ctx.problems,
  };
  setIf(doc, 'description', str(info.value['description']));
  setIf(doc, 'termsOfService', str(info.value['termsOfService']));
  setIf(doc, 'defaultContentType', str(root['defaultContentType']));
  const contact = ctx.object(info.value['contact'], info.baseUrl, '/info/contact');
  if (contact) doc.contact = pick<Contact>(contact.value, ['name', 'url', 'email']);
  const license = ctx.object(info.value['license'], info.baseUrl, '/info/license');
  if (license) {
    const name = str(license.value['name']);
    if (name !== undefined) {
      doc.license = { name };
      setIf(doc.license, 'url', str(license.value['url']));
    }
  }
  const ext = ctx.externalDocs(info.value['externalDocs'], info.baseUrl, '/info/externalDocs');
  if (ext) doc.externalDocs = ext;

  const state = new V3State(ctx, base, doc, schemaFormatDefault);
  state.servers(root['servers']);
  state.componentMessages(root['components']);
  state.channels(root['channels']);
  state.operations(root['operations']);
  state.componentSchemas(root['components']);
  return doc;
}

class V3State {
  readonly serverIds = new Set<string>();
  /** Channels by key, built lazily because operations reference them by `$ref`. */
  readonly channelsByKey = new Map<string, Channel>();
  /** Messages by resolved id, so a `$ref` to components.messages reuses the same object. */
  readonly messagesById = new Map<string, Message>();

  constructor(
    readonly ctx: Context,
    readonly base: string,
    readonly doc: Document,
    readonly schemaFormatDefault: string,
  ) {}

  servers(map: unknown): void {
    for (const [key, located, where] of this.ctx.entries(map, this.base, '/servers')) {
      this.doc.servers.push(this.server(key, located, where));
      this.serverIds.add(key);
    }
  }

  server(key: string, { value, baseUrl }: Located, where: string): Server {
    const host = str(value['host']) ?? '';
    const pathname = str(value['pathname']) ?? '';
    const server: Server = {
      id: key,
      anchor: this.ctx.anchor('servers', key),
      protocol: str(value['protocol']) ?? '',
      hostDisplay: `${host}${pathname}`,
      variables: [],
      security: this.security(value['security'], baseUrl, `${where}/security`),
      tags: this.ctx.tags(value['tags'], baseUrl, `${where}/tags`),
      bindings: this.ctx.bindings('server', value['bindings'], baseUrl, `${where}/bindings`),
    };
    setIf(server, 'title', str(value['title']));
    setIf(server, 'summary', str(value['summary']));
    setIf(server, 'description', str(value['description']));
    setIf(server, 'protocolVersion', str(value['protocolVersion']));
    const ext = this.ctx.externalDocs(value['externalDocs'], baseUrl, `${where}/externalDocs`);
    if (ext) server.externalDocs = ext;
    for (const [name, v, w] of this.ctx.entries(value['variables'], baseUrl, `${where}/variables`)) {
      const variable: ServerVariable = { name };
      setIf(variable, 'description', str(v.value['description']));
      setIf(variable, 'default', str(v.value['default']));
      if (Array.isArray(v.value['enum'])) variable.enum = v.value['enum'].map(String);
      if (Array.isArray(v.value['examples'])) variable.examples = v.value['examples'].map(String);
      server.variables.push(variable);
      void w;
    }
    return server;
  }

  security(list: unknown, baseUrl: string, where: string): SecurityRequirement[] {
    const out: SecurityRequirement[] = [];
    for (const [located, w] of this.ctx.items(list, baseUrl, where)) {
      const id = Context.keyOf(located.id) ?? str(located.value['type']) ?? 'security';
      const req: SecurityRequirement = {
        id,
        type: str(located.value['type']) ?? '',
        scopes: Array.isArray(located.value['scopes']) ? located.value['scopes'].map(String) : [],
      };
      setIf(req, 'description', str(located.value['description']));
      out.push(req);
      void w;
    }
    return out;
  }

  componentMessages(components: unknown): void {
    if (!isObj(components)) return;
    for (const [key, located, where] of this.ctx.entries(components['messages'], this.base, '/components/messages')) {
      const id = located.id ?? `${this.base}#${where}`;
      const message = this.message(key, key, located, where);
      this.messagesById.set(id, message);
      this.doc.messages.push(message);
    }
  }

  componentSchemas(components: unknown): void {
    if (!isObj(components)) return;
    const schemas = components['schemas'];
    if (schemas === undefined) return;
    if (!isObj(schemas)) {
      this.ctx.problem('warning', 'Expected a map at "/components/schemas"; it was skipped.', '/components/schemas');
      return;
    }
    for (const [key, raw] of Object.entries(schemas)) {
      const where = `/components/schemas/${key}`;
      const schema = buildSchema(this.ctx, { raw, baseUrl: this.base, where, name: key, defaultFormat: this.schemaFormatDefault });
      if (schema) this.doc.schemas.push({ id: key, anchor: this.ctx.anchor('schemas', key), schema });
    }
  }

  channels(map: unknown): void {
    for (const [key, located, where] of this.ctx.entries(map, this.base, '/channels')) {
      this.channelsByKey.set(key, this.channel(key, located, where));
    }
  }

  channel(key: string, { value, baseUrl }: Located, where: string): Channel {
    const address = str(value['address']);
    const channel: Channel = {
      id: key,
      address: address === undefined ? null : address,
      parameters: [],
      servers: [],
      tags: this.ctx.tags(value['tags'], baseUrl, `${where}/tags`),
      bindings: this.ctx.bindings('channel', value['bindings'], baseUrl, `${where}/bindings`),
    };
    setIf(channel, 'title', str(value['title']));
    setIf(channel, 'summary', str(value['summary']));
    setIf(channel, 'description', str(value['description']));
    const ext = this.ctx.externalDocs(value['externalDocs'], baseUrl, `${where}/externalDocs`);
    if (ext) channel.externalDocs = ext;
    for (const [name, v] of this.ctx.entries(value['parameters'], baseUrl, `${where}/parameters`)) {
      const parameter: Parameter = { name };
      setIf(parameter, 'description', str(v.value['description']));
      setIf(parameter, 'default', str(v.value['default']));
      setIf(parameter, 'location', str(v.value['location']));
      if (Array.isArray(v.value['enum'])) parameter.enum = v.value['enum'].map(String);
      if (Array.isArray(v.value['examples'])) parameter.examples = v.value['examples'].map(String);
      channel.parameters.push(parameter);
    }
    for (const [located, w] of this.ctx.items(value['servers'], baseUrl, `${where}/servers`)) {
      const id = Context.keyOf(located.id);
      if (id === undefined || !this.serverIds.has(id)) {
        this.ctx.problem('warning', `Channel "${key}" lists a server that is not in "servers"; it was ignored.`, w);
        continue;
      }
      channel.servers.push(id);
    }
    // Channel messages are built here (and cached by id) so operations can pick them by reference.
    const ordered: Message[] = [];
    for (const [msgKey, located, w] of this.ctx.entries(value['messages'], baseUrl, `${where}/messages`)) {
      ordered.push(this.channelMessage(key, msgKey, located, w));
    }
    this.channelMessageOrder.set(key, ordered);
    return channel;
  }

  /** The Message for a channel message entry, reusing the component message when it is a `$ref` to one. */
  channelMessage(channelKey: string, msgKey: string, located: Located, where: string): Message {
    const id = located.id ?? `${this.base}#${where}`;
    const existing = this.messagesById.get(id);
    if (existing) return existing;
    const message = this.message(Context.keyOf(located.id) ?? msgKey, `${channelKey}-${msgKey}`, located, where);
    this.messagesById.set(id, message);
    return message;
  }

  message(id: string, anchorSeed: string, located: Located, where: string): Message {
    const baseUrl = located.baseUrl;
    const value = this.ctx.withTraits(located.value, baseUrl, where, ['payload', 'traits']);
    const message: Message = {
      id,
      anchor: this.ctx.anchor('messages', anchorSeed),
      contentType: str(value['contentType']) ?? this.doc.defaultContentType ?? 'application/json',
      schemaFormat: this.schemaFormatDefault,
      examples: [],
      tags: this.ctx.tags(value['tags'], baseUrl, `${where}/tags`),
      bindings: this.ctx.bindings('message', value['bindings'], baseUrl, `${where}/bindings`),
    };
    setIf(message, 'name', str(value['name']));
    setIf(message, 'title', str(value['title']));
    setIf(message, 'summary', str(value['summary']));
    setIf(message, 'description', str(value['description']));
    const ext = this.ctx.externalDocs(value['externalDocs'], baseUrl, `${where}/externalDocs`);
    if (ext) message.externalDocs = ext;

    const payloadRaw = value['payload'];
    if (isObj(payloadRaw) && typeof payloadRaw['schemaFormat'] === 'string') message.schemaFormat = payloadRaw['schemaFormat'];
    const payload = buildSchema(this.ctx, { raw: payloadRaw, baseUrl, where: `${where}/payload`, name: '', defaultFormat: this.schemaFormatDefault });
    if (payload) message.payload = payload;
    const headers = buildSchema(this.ctx, { raw: value['headers'], baseUrl, where: `${where}/headers`, name: '', defaultFormat: this.schemaFormatDefault });
    if (headers) message.headers = headers;

    const correlation = this.ctx.object(value['correlationId'], baseUrl, `${where}/correlationId`);
    if (correlation) {
      const location = str(correlation.value['location']);
      if (location !== undefined) {
        const c: CorrelationId = { location };
        setIf(c, 'description', str(correlation.value['description']));
        message.correlationId = c;
      }
    }
    for (const [ex] of this.ctx.items(value['examples'], baseUrl, `${where}/examples`)) {
      const example: MessageExample = {};
      setIf(example, 'name', str(ex.value['name']));
      setIf(example, 'summary', str(ex.value['summary']));
      if ('payload' in ex.value) example.payload = ex.value['payload'];
      if ('headers' in ex.value) example.headers = ex.value['headers'];
      message.examples.push(example);
    }
    return message;
  }

  operations(map: unknown): void {
    for (const [key, located, where] of this.ctx.entries(map, this.base, '/operations')) {
      const op = this.operation(key, located, where);
      if (op) this.doc.operations.push(op);
    }
  }

  operation(key: string, located: Located, where: string): Operation | undefined {
    const baseUrl = located.baseUrl;
    const value = this.ctx.withTraits(located.value, baseUrl, where, ['action', 'channel', 'messages', 'reply', 'traits']);
    const action = str(value['action']);
    if (action !== 'send' && action !== 'receive') {
      this.ctx.problem('error', `Operation "${key}" has action "${action ?? ''}"; expected send or receive. It was skipped.`, `${where}/action`);
      return undefined;
    }
    const channelRef = this.ctx.object(value['channel'], baseUrl, `${where}/channel`);
    const channelKey = Context.keyOf(channelRef?.id);
    const channel = channelKey === undefined ? undefined : this.channelsByKey.get(channelKey);
    if (!channel) {
      this.ctx.problem('error', `Operation "${key}" does not reference a channel in "channels". It was skipped.`, `${where}/channel`);
      return undefined;
    }

    if (this.channelMessagesOf(channel.id).length === 0) {
      this.ctx.problem('warning', `Operation "${key}" uses channel "${channel.id}", which defines no messages.`, `${where}/channel`);
    }
    const reply = this.reply(value['reply'], baseUrl, `${where}/reply`);
    const kind: OperationKind = reply ? (action === 'send' ? 'request' : 'reply') : action;
    const labels = this.ctx.options.labels;
    const op: Operation = {
      id: key,
      anchor: this.ctx.anchor('operations', key),
      heading: this.ctx.options.useChannelAddressAsIdentifier ? (channel.address ?? key) : (str(value['title']) ?? key),
      action,
      kind,
      badgeLabel: labels[kind],
      locationHint: key,
      channel,
      tags: this.ctx.tags(value['tags'], baseUrl, `${where}/tags`),
      messages: this.operationMessages(key, value['messages'], channel.id, baseUrl, `${where}/messages`),
      security: this.security(value['security'], baseUrl, `${where}/security`),
      bindings: this.ctx.bindings('operation', value['bindings'], baseUrl, `${where}/bindings`),
    };
    setIf(op, 'summary', str(value['summary']));
    setIf(op, 'description', str(value['description']));
    const ext = this.ctx.externalDocs(value['externalDocs'], baseUrl, `${where}/externalDocs`);
    if (ext) op.externalDocs = ext;
    if (reply) op.reply = reply;
    return op;
  }

  /** The operation's messages: the listed subset of the channel's messages, or all of them. */
  operationMessages(opKey: string, list: unknown, channelKey: string, baseUrl: string, where: string): Message[] {
    const channelMessages = this.channelMessagesOf(channelKey);
    if (list === undefined) return channelMessages;
    const out: Message[] = [];
    for (const [located, w] of this.ctx.items(list, baseUrl, where)) {
      const message = located.id === undefined ? undefined : this.messagesById.get(located.id);
      if (!message || !channelMessages.includes(message)) {
        this.ctx.problem('warning', `Operation "${opKey}" lists a message that is not one of its channel's messages; it was ignored.`, w);
        continue;
      }
      out.push(message);
    }
    return out;
  }

  /** Channel messages in document order, by channel key. */
  readonly channelMessageOrder = new Map<string, Message[]>();

  channelMessagesOf(channelKey: string): Message[] {
    return this.channelMessageOrder.get(channelKey) ?? [];
  }

  reply(raw: unknown, baseUrl: string, where: string): Reply | undefined {
    const located = this.ctx.object(raw, baseUrl, where);
    if (!located) return undefined;
    const reply: Reply = { messages: [] };
    const address = this.ctx.object(located.value['address'], located.baseUrl, `${where}/address`);
    if (address) {
      setIf(reply, 'addressLocation', str(address.value['location']));
      setIf(reply, 'addressDescription', str(address.value['description']));
    }
    const channelRef = this.ctx.object(located.value['channel'], located.baseUrl, `${where}/channel`);
    const channelKey = Context.keyOf(channelRef?.id);
    const channel = channelKey === undefined ? undefined : this.channelsByKey.get(channelKey);
    if (channelRef && !channel) {
      this.ctx.problem('warning', `A reply references a channel that is not in "channels"; it was ignored.`, `${where}/channel`);
    }
    if (channel) reply.channel = channel;
    const listed = located.value['messages'];
    if (listed === undefined && channelKey !== undefined) {
      reply.messages = this.channelMessagesOf(channelKey).map(ref);
    } else {
      for (const [m, w] of this.ctx.items(listed, located.baseUrl, `${where}/messages`)) {
        const message = m.id === undefined ? undefined : this.messagesById.get(m.id);
        if (!message) {
          this.ctx.problem('warning', `A reply lists a message that is not one of the reply channel's messages; it was ignored.`, w);
          continue;
        }
        reply.messages.push(ref(message));
      }
    }
    return reply;
  }
}

function ref(m: Message): MessageRef {
  const out: MessageRef = { id: m.id, anchor: m.anchor };
  setIf(out, 'name', m.name);
  setIf(out, 'title', m.title);
  return out;
}

function setIf<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value;
}

function pick<T extends object>(source: Obj, keys: Array<keyof T & string>): T {
  const out = {} as T;
  for (const key of keys) {
    const v = str(source[key]);
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}
