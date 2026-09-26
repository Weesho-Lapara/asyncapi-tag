/**
 * The example panel (spec 4.7): a dark column beside the operation content with the message
 * name, Payload and Headers tabs, a Copy button that announces through a live region,
 * line-numbered highlighted JSON, a select when there are several examples, and the correlation
 * id location. When `messageExamples` is off the panel starts collapsed to a "Show example" bar.
 * Messages without an authored example get one generated from the schema (amendment 9).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { Message, MessageExample } from '../model/types.js';
import { generateExample } from '../util/example.js';

export const exampleStyles = css`
  .ex {
    background: var(--_ex-bg);
    color: var(--_ex-ink);
    border-radius: var(--_radius);
    overflow: hidden;
    font-size: 13px;
    --_ex-key: color-mix(in srgb, var(--_primary) 50%, white);
    --_ex-string: color-mix(in srgb, var(--_secondary) 45%, white);
  }
  .ex__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    padding: 18px 18px 0;
  }
  .ex__label {
    font: 500 11px/1 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_ex-muted);
  }
  .ex__name {
    font: 600 15px/1.4 var(--_font-heading);
    color: var(--_ex-heading);
  }
  .ex__generated {
    height: 20px;
    padding: 0 7px;
    border: 1px solid var(--_ex-lines);
    color: var(--_ex-muted);
    font-size: 11px;
  }
  .ex__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 14px 18px 0;
  }
  .ex__tabs {
    display: inline-flex;
    gap: 4px;
  }
  .ex__tab {
    min-height: 34px;
    padding: 0 10px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--_ex-muted);
    font: 500 13px/1 var(--_font-body);
    cursor: pointer;
  }
  .ex__tab[aria-selected='true'] {
    color: var(--_ex-heading);
    border-bottom-color: var(--_ex-heading);
  }
  .ex__tab:focus-visible,
  .ex__copy:focus-visible,
  .ex__select:focus-visible {
    outline: 2px solid var(--_ex-key);
    outline-offset: 1px;
  }
  .ex__spacer {
    flex: 1;
  }
  .ex__select-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--_ex-muted);
    font-size: 12px;
  }
  .ex__select {
    min-height: 30px;
    padding: 0 8px;
    border: 1px solid var(--_ex-lines);
    border-radius: var(--_radius-sm);
    background: rgb(255 255 255 / 0.06);
    color: var(--_ex-ink);
    font: 12.5px/1 var(--_font-body);
  }
  .ex__copy {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid var(--_ex-lines);
    border-radius: var(--_radius-sm);
    background: none;
    color: var(--_ex-ink);
    font: 500 12.5px/1 var(--_font-body);
    cursor: pointer;
  }
  .ex__copy:hover {
    background: rgb(255 255 255 / 0.06);
  }
  .ex__copy svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ex__code {
    margin: 8px 0 0;
    padding: 14px 18px 18px 0;
    overflow: auto;
    font: 12.5px/1.7 var(--_font-mono);
    border-top: 1px solid var(--_ex-divider);
    counter-reset: line;
  }
  .ex__line {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
  }
  .ex__text {
    white-space: pre;
  }
  .ex__line::before {
    counter-increment: line;
    content: counter(line);
    text-align: right;
    padding-right: 14px;
    color: var(--_ex-lines);
    user-select: none;
  }
  .tk-key {
    color: var(--_ex-key);
  }
  .tk-str {
    color: var(--_ex-string);
  }
  .tk-num,
  .tk-bool,
  .tk-null {
    color: var(--_ex-number);
  }
  .tk-punct {
    color: var(--_ex-muted);
  }
  .ex__foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    padding: 12px 18px 14px;
    border-top: 1px solid var(--_ex-divider);
    font: 12px/1.5 var(--_font-body);
    color: var(--_ex-muted);
  }
  .ex__foot code {
    font: 12px/1.5 var(--_font-mono);
  }
  .ex__foot code {
    color: var(--_ex-ink);
  }
  .ex__live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .ex__show {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 12px;
    border: 1px dashed var(--_line-2);
    border-radius: var(--_radius-sm);
    background: var(--_surface);
    color: var(--_ink-2);
    font: 500 12.5px/1 var(--_font-body);
    cursor: pointer;
  }
  .ex__show:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 2px;
  }
`;

export interface ExamplePanelState {
  tab: 'payload' | 'headers';
  index: number;
  open: boolean | undefined;
  copied: 'copied' | 'failed' | undefined;
}

export interface ExampleContext {
  state: ExamplePanelState;
  /** Whether panels start open (`messageExamples` option). */
  defaultOpen: boolean;
  onChange: () => void;
}

export interface ResolvedExample {
  label: string;
  payload: unknown;
  headers: unknown;
  generated: boolean;
}

/** Authored examples, or one generated from the schemas. */
export function examplesFor(message: Message): ResolvedExample[] {
  if (message.examples.length > 0) {
    return message.examples.map((ex: MessageExample, i) => ({
      label: ex.name ?? `Example ${i + 1}`,
      payload: ex.payload,
      headers: ex.headers,
      generated: false,
    }));
  }
  const payload = generateExample(message.payload);
  const headers = generateExample(message.headers);
  if (payload === undefined && headers === undefined) return [];
  return [{ label: 'Generated', payload, headers, generated: true }];
}

export function isPanelOpen(ctx: ExampleContext): boolean {
  return ctx.state.open ?? ctx.defaultOpen;
}

const copyIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>`;

/** The slim bar shown in the content column while the panel is collapsed. */
export function renderShowExample(ctx: ExampleContext): TemplateResult {
  return html`<button
    class="ex__show"
    type="button"
    aria-expanded="false"
    @click=${() => {
      ctx.state.open = true;
      ctx.onChange();
    }}
  >
    ${copyIcon} Show example
  </button>`;
}

export function renderExamplePanel(message: Message, examples: ResolvedExample[], ctx: ExampleContext, panelId: string): TemplateResult | typeof nothing {
  if (examples.length === 0) return nothing;
  const state = ctx.state;
  const index = Math.min(state.index, examples.length - 1);
  const example = examples[index]!;
  const hasHeaders = example.headers !== undefined;
  const tab = hasHeaders && state.tab === 'headers' ? 'headers' : 'payload';
  const value = tab === 'headers' ? example.headers : example.payload;
  const text = value === undefined ? '' : JSON.stringify(value, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      state.copied = 'copied';
    } catch {
      state.copied = 'failed';
    }
    ctx.onChange();
    setTimeout(() => {
      state.copied = undefined;
      ctx.onChange();
    }, 2000);
  };
  return html`<aside class="ex" aria-label="Example for ${message.id}">
    <div class="ex__head">
      <span class="ex__label">Example</span>
      <span class="ex__name">${message.id}</span>
      ${example.generated ? html`<span class="pill ex__generated" title="No example in the document; this one was generated from the schema">Generated from schema</span>` : nothing}
    </div>
    <div class="ex__bar">
      ${hasHeaders
        ? html`<div class="ex__tabs" role="tablist" aria-label="Example parts">
            ${(['payload', 'headers'] as const).map(
              (t) => html`<button
                class="ex__tab"
                type="button"
                role="tab"
                id="${panelId}--tab-${t}"
                aria-selected=${tab === t ? 'true' : 'false'}
                aria-controls="${panelId}--code"
                tabindex=${tab === t ? '0' : '-1'}
                @click=${() => {
                  state.tab = t;
                  ctx.onChange();
                }}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    state.tab = state.tab === 'payload' ? 'headers' : 'payload';
                    ctx.onChange();
                    e.preventDefault();
                  }
                }}
              >
                ${t === 'payload' ? 'Payload' : 'Headers'}
              </button>`,
            )}
          </div>`
        : nothing}
      ${examples.length > 1
        ? html`<label class="ex__select-wrap"
            ><span>Example</span>
            <select
              class="ex__select"
              @change=${(e: Event) => {
                state.index = Number((e.target as HTMLSelectElement).value);
                ctx.onChange();
              }}
            >
              ${examples.map((ex, i) => html`<option value=${i} ?selected=${i === index}>${ex.label}</option>`)}
            </select></label
          >`
        : nothing}
      <span class="ex__spacer"></span>
      <button class="ex__copy" type="button" @click=${copy}>${copyIcon} ${state.copied === 'copied' ? 'Copied' : state.copied === 'failed' ? 'Copy failed' : 'Copy'}</button>
      <span class="ex__live" aria-live="polite">${state.copied === 'copied' ? 'Copied to clipboard' : state.copied === 'failed' ? 'Copying failed; select the text to copy it' : ''}</span>
    </div>
    <pre class="ex__code" id="${panelId}--code" role=${hasHeaders ? 'tabpanel' : nothing} aria-labelledby=${hasHeaders ? `${panelId}--tab-${tab}` : nothing}><code>${highlight(text)}</code></pre>
    ${message.correlationId
      ? html`<div class="ex__foot"><span>Correlation ID</span><code>${message.correlationId.location}</code></div>`
      : nothing}
  </aside>`;
}

/** Tokenise pretty-printed JSON into spans, one grid row per line for the line numbers. */
export function highlight(text: string): TemplateResult[] {
  return text.split('\n').map((line) => html`<span class="ex__line"><span class="ex__text">${tokens(line)}</span></span>`);
}

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false)|(null)|([{}[\],:])|(\s+)/g;

function tokens(line: string): Array<TemplateResult | string> {
  const out: Array<TemplateResult | string> = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index! > last) out.push(line.slice(last, m.index));
    last = m.index! + m[0].length;
    if (m[1] !== undefined) {
      if (m[2] !== undefined) out.push(html`<span class="tk-key">${m[1]}</span><span class="tk-punct">${m[2]}</span>`);
      else out.push(html`<span class="tk-str">${m[1]}</span>`);
    } else if (m[3] !== undefined) out.push(html`<span class="tk-num">${m[3]}</span>`);
    else if (m[4] !== undefined) out.push(html`<span class="tk-bool">${m[4]}</span>`);
    else if (m[5] !== undefined) out.push(html`<span class="tk-null">${m[5]}</span>`);
    else if (m[6] !== undefined) out.push(html`<span class="tk-punct">${m[6]}</span>`);
    else out.push(m[0]);
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
