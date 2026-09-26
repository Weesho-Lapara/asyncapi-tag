import { describe, expect, it } from 'vitest';
import { DEFAULTS, OPTION_SPECS, lookupOption, parseOptions, toAttributeName, type Options } from '../src/options.js';

function parse(attrs: Record<string, string | null>) {
  const warnings: string[] = [];
  const options = parseOptions(Object.entries(attrs), (m) => warnings.push(m));
  return { options, warnings };
}

describe('schema and defaults agree', () => {
  it('every active option with a default is in DEFAULTS, and nothing else', () => {
    const expected = OPTION_SPECS.filter((o) => o.status === 'active' && o.default != null).map((o) => o.name).sort();
    expect(Object.keys(DEFAULTS).sort()).toEqual(expected);
  });

  it('enum defaults are among their values and names are unique camelCase', () => {
    const names = new Set<string>();
    for (const o of OPTION_SPECS) {
      expect(o.name).toMatch(/^[a-z][A-Za-z]*$/);
      expect(names.has(o.name)).toBe(false);
      names.add(o.name);
      if (o.type === 'enum') expect(o.values).toContain(o.default);
      expect(o.specVersions.length).toBeGreaterThan(0);
    }
  });

  it('matches the contract from the spec', () => {
    expect(DEFAULTS).toEqual({
      sidebar: false, info: true, servers: true, operations: true, messages: true, schemas: true, errors: true,
      showMessageExamples: false, messageExamples: true, showServers: 'byDefault', showOperations: 'byDefault',
      useChannelAddressAsIdentifier: false, publishLabel: 'PUB', subscribeLabel: 'SUB', sendLabel: 'SEND',
      receiveLabel: 'RECEIVE', requestLabel: 'REQUEST', replyLabel: 'REPLY', parserOptions: { applyTraits: true },
      theme: 'auto', themeToggle: false, searchKeepSections: false,
    } satisfies Options);
  });
});

describe('the Python boolean table', () => {
  const table: Array<[string | null, boolean]> = [
    ['true', true], ['1', true], ['yes', true], ['on', true], ['TRUE', true], [' Yes ', true], [null, true], ['', true], ['  ', true],
    ['false', false], ['0', false], ['no', false], ['off', false], ['False', false], [' OFF ', false],
  ];
  it.each(table)('sidebar=%j parses to %s', (raw, expected) => {
    const { options, warnings } = parse({ sidebar: raw });
    expect(options.sidebar).toBe(expected);
    expect(warnings).toEqual([]);
  });

  it.each(['maybe', '2', 'nope'])('sidebar=%j warns and keeps the default', (raw) => {
    const { options, warnings } = parse({ sidebar: raw });
    expect(options.sidebar).toBe(DEFAULTS.sidebar);
    expect(warnings).toEqual([`<asyncapi-viewer>: attribute 'sidebar' expects true or false, got '${raw}'.`]);
  });
});

describe('every option is accepted in each spelling', () => {
  const sample: Record<string, string> = {
    boolean: 'false', string: 'CUSTOM', json: '{"applyTraits": false}',
  };
  for (const spec of OPTION_SPECS) {
    if (spec.status !== 'active' || spec.name === 'src' || spec.name === 'id') continue;
    // A value that differs from the default, so the assertion proves the attribute was applied.
    const raw = spec.type === 'enum' ? spec.values!.find((v) => v !== spec.default)! : spec.type === 'boolean' ? String(!spec.default) : sample[spec.type]!;
    const expected: unknown = spec.type === 'boolean' ? !spec.default : spec.type === 'json' ? { applyTraits: false } : raw;
    const spellings = [spec.name, toAttributeName(spec.name), spec.name.toLowerCase(), toAttributeName(spec.name).toUpperCase()];
    for (const spelling of spellings) {
      it(`${spelling}=${raw}`, () => {
        const { options, warnings } = parse({ [spelling]: raw });
        expect(warnings).toEqual([]);
        expect((options as unknown as Record<string, unknown>)[spec.name]).toEqual(expected);
      });
    }
  }

  it('lookupOption resolves all spellings and rejects unknown names', () => {
    expect(lookupOption('send-label')?.name).toBe('sendLabel');
    expect(lookupOption('SENDLABEL')?.name).toBe('sendLabel');
    expect(lookupOption('use-channel-address-as-identifier')?.name).toBe('useChannelAddressAsIdentifier');
    expect(lookupOption('bogus')).toBeUndefined();
  });
});

describe('enums', () => {
  it('match case-insensitively and return the canonical value', () => {
    expect(parse({ showoperations: 'byspectags' }).options.showOperations).toBe('bySpecTags');
    expect(parse({ theme: 'DARK' }).options.theme).toBe('dark');
  });
  it('warn on unknown values and keep the default', () => {
    const { options, warnings } = parse({ showServers: 'nope' });
    expect(options.showServers).toBe('byDefault');
    expect(warnings).toEqual([
      "<asyncapi-viewer>: attribute 'showServers' expects one of byDefault, bySpecTags, byServersTags; got 'nope'.",
    ]);
  });
});

describe('parserOptions', () => {
  it('honours applyTraits', () => {
    expect(parse({ parserOptions: '{"applyTraits": false}' }).options.parserOptions).toEqual({ applyTraits: false });
  });
  it('warns on invalid JSON, non-objects, unknown keys and wrong types', () => {
    expect(parse({ parserOptions: '{oops' }).warnings[0]).toMatch(/^<asyncapi-viewer>: attribute 'parserOptions' is not valid JSON \(/);
    expect(parse({ parserOptions: '[1]' }).warnings).toEqual(["<asyncapi-viewer>: attribute 'parserOptions' expects a JSON object, got [1]."]);
    const { options, warnings } = parse({ parserOptions: '{"applyTraits": "no", "schemaParser": 1}' });
    expect(options.parserOptions).toEqual({ applyTraits: true });
    expect(warnings).toEqual([
      '<asyncapi-viewer>: parserOptions.applyTraits expects a boolean, got "no".',
      '<asyncapi-viewer>: parserOptions.schemaParser is not supported and was ignored.',
    ]);
  });
});

describe('strings, src, id, deprecated and unknown attributes', () => {
  it('strings pass through, a bare string attribute is empty', () => {
    expect(parse({ 'publish-label': 'PUBLISH' }).options.publishLabel).toBe('PUBLISH');
    expect(parse({ sendlabel: null }).options.sendLabel).toBe('');
  });
  it('src and id pass through untouched', () => {
    const { options } = parse({ src: 'a b.yaml', id: 'x' });
    expect(options.src).toBe('a b.yaml');
    expect(options.id).toBe('x');
    expect(parse({}).options.src).toBeUndefined();
  });
  it('schemaID is deprecated: warns and does nothing', () => {
    const { options, warnings } = parse({ schemaID: 'x' });
    expect('schemaID' in options).toBe(false);
    expect(warnings).toEqual(["<asyncapi-viewer>: attribute 'schemaID' is deprecated and does nothing."]);
  });
  it('unknown attributes warn once each; HTML global, data- and aria- attributes are silent', () => {
    const { warnings } = parse({ bogus: '1', class: 'wide', 'data-x': '1', 'aria-label': 'y', style: '', hidden: null });
    expect(warnings).toEqual(["<asyncapi-viewer>: unknown attribute 'bogus' was ignored."]);
  });
  it('one bad value does not stop the others', () => {
    const { options, warnings } = parse({ sidebar: 'maybe', info: 'no', 'send-label': 'EMIT' });
    expect(options).toMatchObject({ sidebar: false, info: false, sendLabel: 'EMIT' });
    expect(warnings).toHaveLength(1);
  });
});
