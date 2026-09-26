/**
 * AsyncAPI 2 normaliser. Direction mapping is the rule to remember: in v2, `publish` describes
 * what the application receives and `subscribe` what it sends. The badge keeps the raw keyword
 * (`PUB` / `SUB` by default), the location hint keeps the channel path.
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
  Operation,
  Parameter,
  SecurityRequirement,
  Server,
  ServerVariable,
} from './types.js';

export function normalizeV2(ctx: Context, root: Obj, specVersion: string): Document {
  const base = ctx.resolver.rootUrl;
  const schemaFormatDefault = `application/vnd.aai.asyncapi;version=${specVersion}`;
  const info = ctx.object(root['info'], base, '/info') ?? { value: {}, baseUrl: base, id: undefined };
  if (!isObj(root['info'])) ctx.problem('error', 'The document has no "info" object.', '/info');

  const doc: Document = {
    specVersion,
    specMajor: 2,
    title: str(info.value['title']) ?? 'Untitled API',
    version: str(info.value['version']) ?? '',
    tags: ctx.tags(root['tags'], base, '/tags'),
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
  if (contact) {
    const c: Contact = {};
    setIf(c, 'name', str(contact.value['name']));
    setIf(c, 'url', str(contact.value['url']));
    setIf(c, 'email', str(contact.value['email']));
    doc.contact = c;
  }
  const license = ctx.object(info.value['license'], info.baseUrl, '/info/license');
  const licenseName = license ? str(license.value['name']) : undefined;
  if (license && licenseName !== undefined) {
    doc.license = { name: licenseName };
    setIf(doc.license, 'url', str(license.value['url']));
  }
  const ext = ctx.externalDocs(root['externalDocs'], base, '/externalDocs');
  if (ext) doc.externalDocs = ext;

  const state = new V2State(ctx, base, doc, schemaFormatDefault, isObj(root['components']) ? root['components'] : {});
  state.servers(root['servers']);
  state.componentMessages();
  state.channels(root['channels']);
  state.componentSchemas();
  return doc;
}

class V2State {
  readonly serverIds = new Set<string>();
  readonly messagesById = new Map<string, Message>();

  constructor(
    readonly ctx: Context,
    readonly base: string,
    readonly doc: Document,
    readonly schemaFormatDefault: string,
    readonly components: Obj,
  ) {}

  servers(map: unknown): void {
    for (const [key, located, where] of this.ctx.entries(map, this.base, '/servers')) {
      const { value, baseUrl } = located;
      const server: Server = {
        id: key,
        anchor: this.ctx.anchor('servers', key),
        protocol: str(value['protocol']) ?? '',
        hostDisplay: str(value['url']) ?? '',
        variables: [],
        security: this.security(value['security'], baseUrl, `${where}/security`),
        tags: this.ctx.tags(value['tags'], baseUrl, `${where}/tags`),
        bindings: this.ctx.bindings('server', value['bindings'], baseUrl, `${where}/bindings`),
      };
      setIf(server, 'description', str(value['description']));
      setIf(server, 'protocolVersion', str(value['protocolVersion']));
      for (const [name, v] of this.ctx.entries(value['variables'], baseUrl, `${where}/variables`)) {
        const variable: ServerVariable = { name };
        setIf(variable, 'description', str(v.value['description']));
        setIf(variable, 'default', str(v.value['default']));
        if (Array.isArray(v.value['enum'])) variable.enum = v.value['enum'].map(String);
        if (Array.isArray(v.value['examples'])) variable.examples = v.value['examples'].map(String);
        server.variables.push(variable);
      }
      this.doc.servers.push(server);
      this.serverIds.add(key);
    }
  }

  /** v2 Security Requirement Objects: `[{ schemeName: [scopes] }]`, looked up in components. */
  security(list: unknown, baseUrl: string, where: string): SecurityRequirement[] {
    const out: SecurityRequirement[] = [];
    if (list === undefined) return out;
    if (!Array.isArray(list)) {
      this.ctx.problem('warning', `Expected a list at "${where}"; it was skipped.`, where);
      return out;
    }
    list.forEach((entry, i) => {
      if (!isObj(entry)) return;
      for (const [name, scopes] of Object.entries(entry)) {
        const schemes = this.components['securitySchemes'];
        const scheme = isObj(schemes) ? this.ctx.object(schemes[name], this.base, `/components/securitySchemes/${name}`) : undefined;
        if (!scheme) {
          this.ctx.problem('warning', `Security scheme "${name}" is not defined in components.securitySchemes.`, `${where}/${i}`);
        }
        const req: SecurityRequirement = {
          id: name,
          type: scheme ? (str(scheme.value['type']) ?? '') : '',
          scopes: Array.isArray(scopes) ? scopes.map(String) : [],
        };
        if (scheme) setIf(req, 'description', str(scheme.value['description']));
        out.push(req);
      }
    });
    void baseUrl;
    return out;
  }

  componentMessages(): void {
    for (const [key, located, where] of this.ctx.entries(this.components['messages'], this.base, '/components/messages')) {
      const id = located.id ?? `${this.base}#${where}`;
      const message = this.message(key, key, located, where);
      this.messagesById.set(id, message);
      this.doc.messages.push(message);
    }
  }

  componentSchemas(): void {
    const schemas = this.components['schemas'];
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
      const channel = this.channel(key, located, where);
      for (const keyword of ['publish', 'subscribe'] as const) {
        const raw = located.value[keyword];
        if (raw === undefined) continue;
        const op = this.ctx.object(raw, located.baseUrl, `${where}/${keyword}`);
        if (op) this.doc.operations.push(this.operation(key, keyword, channel, op, `${where}/${keyword}`));
      }
    }
  }

  channel(key: string, { value, baseUrl }: Located, where: string): Channel {
    const channel: Channel = {
      id: key,
      address: key,
      parameters: [],
      servers: [],
      tags: [],
      bindings: this.ctx.bindings('channel', value['bindings'], baseUrl, `${where}/bindings`),
    };
    setIf(channel, 'description', str(value['description']));
    for (const [name, p, w] of this.ctx.entries(value['parameters'], baseUrl, `${where}/parameters`)) {
      channel.parameters.push(this.parameter(name, p, w));
    }
    const servers = value['servers'];
    if (Array.isArray(servers)) {
      servers.forEach((s, i) => {
        if (typeof s === 'string' && this.serverIds.has(s)) channel.servers.push(s);
        else this.ctx.problem('warning', `Channel "${key}" lists server "${String(s)}" which is not in "servers"; it was ignored.`, `${where}/servers/${i}`);
      });
    }
    return channel;
  }

  /** v2 parameters carry a schema; enum, default and examples come from it, and its type is shown. */
  parameter(name: string, { value, baseUrl }: Located, where: string): Parameter {
    const parameter: Parameter = { name };
    setIf(parameter, 'description', str(value['description']));
    setIf(parameter, 'location', str(value['location']));
    const schema = this.ctx.object(value['schema'], baseUrl, `${where}/schema`);
    if (schema) {
      const t = schema.value['type'];
      const type = typeof t === 'string' ? t : Array.isArray(t) ? t.map(String).join(' | ') : undefined;
      setIf(parameter, 'schemaType', type);
      if (Array.isArray(schema.value['enum'])) parameter.enum = schema.value['enum'].map(String);
      setIf(parameter, 'default', str(schema.value['default']));
      if (Array.isArray(schema.value['examples'])) parameter.examples = schema.value['examples'].map(String);
    }
    return parameter;
  }

  operation(channelKey: string, keyword: 'publish' | 'subscribe', channel: Channel, { value, baseUrl }: Located, where: string): Operation {
    const action = keyword === 'publish' ? 'receive' : 'send';
    const id = str(value['operationId']) ?? `${keyword}-${channelKey}`;
    const op: Operation = {
      id,
      anchor: this.ctx.anchor('operations', id),
      heading: str(value['operationId']) ?? `${keyword} ${channelKey}`,
      action,
      kind: action,
      badgeLabel: this.ctx.options.labels[keyword],
      locationHint: `channels › ${channelKey} › ${keyword}`,
      channel,
      tags: this.ctx.tags(value['tags'], baseUrl, `${where}/tags`),
      messages: this.operationMessages(channelKey, keyword, value['message'], baseUrl, `${where}/message`),
      security: this.security(value['security'], baseUrl, `${where}/security`),
      bindings: this.ctx.bindings('operation', value['bindings'], baseUrl, `${where}/bindings`),
    };
    setIf(op, 'summary', str(value['summary']));
    setIf(op, 'description', str(value['description']));
    const ext = this.ctx.externalDocs(value['externalDocs'], baseUrl, `${where}/externalDocs`);
    if (ext) op.externalDocs = ext;
    return op;
  }

  /** `message` is one Message, a `$ref`, or `{ oneOf: [...] }`. */
  operationMessages(channelKey: string, keyword: string, raw: unknown, baseUrl: string, where: string): Message[] {
    const located = this.ctx.object(raw, baseUrl, where);
    if (!located) return [];
    const oneOf = located.value['oneOf'];
    if (Array.isArray(oneOf)) {
      const out: Message[] = [];
      let i = 0;
      for (const [m, w] of this.ctx.items(oneOf, located.baseUrl, `${where}/oneOf`)) {
        out.push(this.messageFor(m, `${channelKey}-${keyword}-${i}`, w));
        i++;
      }
      return out;
    }
    return [this.messageFor(located, `${channelKey}-${keyword}`, where)];
  }

  /** Reuse the component message when referenced; otherwise build an inline one. */
  messageFor(located: Located, anchorSeed: string, where: string): Message {
    const id = located.id ?? `${this.base}#${where}`;
    const existing = this.messagesById.get(id);
    if (existing) return existing;
    const message = this.message(Context.keyOf(located.id) ?? str(located.value['name']) ?? anchorSeed, anchorSeed, located, where);
    this.messagesById.set(id, message);
    return message;
  }

  message(id: string, anchorSeed: string, { value, baseUrl }: Located, where: string): Message {
    const message: Message = {
      id,
      anchor: this.ctx.anchor('messages', anchorSeed),
      contentType: str(value['contentType']) ?? this.doc.defaultContentType ?? 'application/json',
      schemaFormat: str(value['schemaFormat']) ?? this.schemaFormatDefault,
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

    // In v2 the schemaFormat sits on the message and applies to the payload.
    const payload = buildSchema(this.ctx, { raw: value['payload'], baseUrl, where: `${where}/payload`, name: '', defaultFormat: message.schemaFormat });
    if (payload) message.payload = payload;
    const headers = buildSchema(this.ctx, { raw: value['headers'], baseUrl, where: `${where}/headers`, name: '', defaultFormat: this.schemaFormatDefault });
    if (headers) message.headers = headers;

    const correlation = this.ctx.object(value['correlationId'], baseUrl, `${where}/correlationId`);
    const location = correlation ? str(correlation.value['location']) : undefined;
    if (correlation && location !== undefined) {
      const c: CorrelationId = { location };
      setIf(c, 'description', str(correlation.value['description']));
      message.correlationId = c;
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
}

function setIf<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value;
}
