import { css, html, nothing, type TemplateResult } from 'lit';
import type { Document, Message, Operation } from '../model/types.js';
import { renderInline, renderMarkdown } from './markdown.js';
import { renderBindings, renderParameters, renderReply, renderSecurity } from './details.js';
import { examplesFor, isPanelOpen, renderExamplePanel, renderShowExample, type ExampleContext } from './example.js';
import { renderSchema, type TreeState } from './tree.js';

export interface OperationContext {
  prefix: string;
  tree: (key: string) => TreeState;
  example: (key: string) => ExampleContext;
  /** Selected message index per operation anchor. */
  messageIndex: (anchor: string) => number;
  selectMessage: (anchor: string, index: number) => void;
}

export const operationStyles = css`
  .ops__list {
    display: grid;
    gap: 40px;
  }
  .op {
    scroll-margin-top: 16px;
  }
  .op__content {
    min-width: 0;
  }
  .op__content > .block:first-child,
  .op__content > .msg:first-child {
    margin-top: 0;
  }
  /* The message head (tabs, name, format) spans the full width; the tree and the example
     panel start together underneath it. The split depends on the main column's width (a
     container of its own), so beside a sidebar the panel stacks until both have room. */
  .msg__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .msg__trees {
    min-width: 0;
  }
  @container main (min-width: 1100px) {
    .op--split .msg__grid {
      grid-template-columns: minmax(0, 1fr) var(--_example-width);
      gap: 32px;
    }
    .op__example {
      position: sticky;
      top: 16px;
    }
  }
  .msg__head .ex__show {
    margin-left: auto;
  }
  .op + .op {
    padding-top: 40px;
    border-top: 1px solid var(--_line);
  }
  .op__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    margin-bottom: 14px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--_radius-sm);
    font: 500 12px/1 var(--_font-mono);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .badge--send {
    background: var(--_send);
    color: var(--_badge-ink-send);
  }
  .badge--receive {
    background: var(--_receive);
    color: var(--_badge-ink-receive);
  }
  .op__hint {
    font: 400 12.5px/1.4 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
  .op__heading {
    margin: 0 0 18px;
    font: 600 42px/1.1 var(--_font-heading);
    letter-spacing: -0.01em;
    color: var(--_ink);
    overflow-wrap: anywhere;
  }
  .op__heading:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 6px;
    border-radius: 2px;
  }
  .op__channel {
    display: grid;
    gap: 6px;
    margin-bottom: 18px;
  }
  .op__address {
    font: 400 19px/1.35 var(--_font-mono);
    color: var(--_ink);
    word-break: break-all;
  }
  .op__address--none {
    color: var(--_muted);
    font-style: italic;
  }
  .param {
    color: var(--_primary-text);
    text-decoration: underline dotted;
    text-underline-offset: 3px;
    text-decoration-thickness: 1px;
  }
  .op__summary {
    margin: 0 0 12px;
  }
  .op__desc {
    max-width: 72ch;
  }
  .msg {
    margin-top: 22px;
  }
  .msg__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    margin-bottom: 10px;
  }
  .msg__name {
    font: 600 15px/1.4 var(--_font-heading);
    color: var(--_ink);
  }
  .msg__format {
    margin-left: auto;
    font: 400 12px/1.5 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
  .msg__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 14px;
    padding-bottom: 0;
    border-bottom: 1px solid var(--_line);
  }
  .msg__tab {
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    background: none;
    color: var(--_ink-2);
    font: 500 13px/1 var(--_font-body);
    cursor: pointer;
  }
  .msg__tab[aria-selected='true'] {
    color: var(--_primary-text);
    border-bottom-color: var(--_primary);
  }
  .msg__tab:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: -2px;
    border-radius: var(--_radius-sm);
  }
  .msg__part {
    margin-top: 16px;
  }
  .msg__desc {
    margin-bottom: 12px;
    font-size: 13px;
    color: var(--_ink-2);
  }
  @container viewer (max-width: 1099px) {
    .op__heading {
      font-size: 36px;
    }
    .op__address {
      font-size: 17px;
    }
  }
  @container viewer (max-width: 699px) {
    .op__heading {
      font-size: 28px;
    }
    .op__address {
      font-size: 15px;
    }
    .op + .op {
      padding-top: 28px;
    }
    .ops__list {
      gap: 28px;
    }
  }
`;

export function operationAnchor(prefix: string, op: Operation): string {
  return `${prefix}--operations--${op.anchor}`;
}

/** The address with `{parameters}` turned into links to the Parameters table (chunk 1.13). */
export function renderAddress(op: Operation, anchor: string): TemplateResult {
  const address = op.channel.address;
  if (address === null) return html`<span class="op__address op__address--none">Address not specified</span>`;
  const known = new Set(op.channel.parameters.map((p) => p.name));
  const parts = address.split(/(\{[^}]+\})/g).filter((s) => s !== '');
  return html`<span class="op__address">${parts.map((part) => {
    const m = /^\{([^}]+)\}$/.exec(part);
    if (m && known.has(m[1]!)) return html`<a class="param" href="#${anchor}--parameters">${part}</a>`;
    return part;
  })}</span>`;
}

function renderMessage(
  op: Operation,
  message: Message,
  anchor: string,
  index: number,
  ctx: OperationContext,
  panel: TemplateResult | typeof nothing,
  showExample: TemplateResult | typeof nothing,
): TemplateResult {
  const treeKey = `${anchor}--m${index}`;
  const name = (m: Message) => m.title ?? m.name ?? m.id;
  return html`<div class="msg">
    ${op.messages.length > 1
      ? html`<div class="msg__tabs" role="tablist" aria-label="Messages of ${op.heading}">
          ${op.messages.map(
            (m, i) => html`<button
              class="msg__tab"
              type="button"
              role="tab"
              id="${anchor}--tab-${i}"
              aria-selected=${i === index ? 'true' : 'false'}
              aria-controls="${anchor}--message"
              tabindex=${i === index ? '0' : '-1'}
              @click=${() => ctx.selectMessage(anchor, i)}
              @keydown=${(e: KeyboardEvent) => {
                const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (delta === 0) return;
                const next = (index + delta + op.messages.length) % op.messages.length;
                ctx.selectMessage(anchor, next);
                e.preventDefault();
                (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('.msg__tab')[next]?.focus();
              }}
            >
              ${name(m)}
            </button>`,
          )}
        </div>`
      : nothing}
    <div id="${anchor}--message" role=${op.messages.length > 1 ? 'tabpanel' : nothing} aria-labelledby=${op.messages.length > 1 ? `${anchor}--tab-${index}` : nothing}>
      <div class="msg__head">
        <span class="label">Message</span>
        <span class="msg__name">${name(message)}</span>
        <span class="msg__format">${message.contentType} · ${message.schemaFormat}</span>
        ${showExample}
      </div>
      ${message.summary ? html`<div class="msg__desc">${renderInline(message.summary)}</div>` : nothing}
      ${message.description ? html`<div class="msg__desc">${renderMarkdown(message.description)}</div>` : nothing}
      <div class="msg__grid">
        <div class="msg__trees">
          ${message.payload
            ? renderSchema(message.payload, { prefix: ctx.prefix, key: `${treeKey}--payload`, state: ctx.tree(`${treeKey}--payload`) })
            : html`<p class="tree__empty">This message has no payload schema.</p>`}
          ${message.headers
            ? html`<div class="msg__part">
                <div class="msg__head"><span class="label">Headers</span></div>
                ${renderSchema(message.headers, { prefix: ctx.prefix, key: `${treeKey}--headers`, state: ctx.tree(`${treeKey}--headers`) })}
              </div>`
            : nothing}
        </div>
        ${panel !== nothing ? html`<div class="op__example">${panel}</div>` : nothing}
      </div>
    </div>
  </div>`;
}

export function renderOperation(op: Operation, ctx: OperationContext): TemplateResult {
  const prefix = ctx.prefix;
  const anchor = operationAnchor(prefix, op);
  const direction = op.action === 'send' ? 'send' : 'receive';
  const index = Math.min(ctx.messageIndex(anchor), Math.max(op.messages.length - 1, 0));
  const message = op.messages[index];
  const examples = message ? examplesFor(message) : [];
  const exampleCtx = ctx.example(`${anchor}--example--m${index}`);
  const open = examples.length > 0 && isPanelOpen(exampleCtx);
  const bindings = [...op.channel.bindings, ...op.bindings, ...(message?.bindings ?? [])];
  return html`
    <article class="op ${open ? 'op--split' : ''}" id=${anchor} aria-labelledby="${anchor}--heading">
      <div class="op__intro">
        <div class="op__meta">
          <span class="badge badge--${direction}">${op.badgeLabel}</span>
          <span class="op__hint">${op.locationHint}</span>
        </div>
        <h3 class="op__heading" id="${anchor}--heading" tabindex="-1">${op.heading}</h3>
        <div class="op__channel">
          <span class="label">Channel</span>
          ${renderAddress(op, anchor)}
        </div>
        ${op.summary ? html`<p class="summary op__summary">${renderInline(op.summary)}</p>` : nothing}
        ${op.description ? html`<div class="op__desc">${renderMarkdown(op.description)}</div>` : nothing}
        ${renderParameters(op.channel.parameters, anchor)}
      </div>
      <div class="op__content">
        ${message
          ? renderMessage(
              op,
              message,
              anchor,
              index,
              ctx,
              open ? renderExamplePanel(message, examples, exampleCtx, `${anchor}--example`) : nothing,
              examples.length > 0 && !open ? renderShowExample(exampleCtx) : nothing,
            )
          : html`<p class="tree__empty block">This operation has no messages.</p>`}
        ${op.reply ? renderReply(op.reply, prefix) : nothing}
        ${renderBindings(bindings)}
        ${renderSecurity(op.security, `#${prefix}--servers`)}
      </div>
    </article>
  `;
}

export function renderOperations(doc: Document, operations: Operation[], ctx: OperationContext, filteredBy?: string): TemplateResult | typeof nothing {
  if (doc.operations.length === 0) return nothing;
  const id = `${ctx.prefix}--operations`;
  const hidden = doc.operations.length - operations.length;
  return html`
    <section class="ops" aria-labelledby=${id}>
      <h2 class="section-title" id=${id} tabindex="-1">Operations</h2>
      ${filteredBy && hidden > 0
        ? html`<p class="filtered" role="status">Showing operations available on <strong>${filteredBy}</strong>; ${hidden} other${hidden === 1 ? '' : 's'} hidden.</p>`
        : nothing}
      <div class="ops__list">${operations.map((op) => renderOperation(op, ctx))}</div>
    </section>
  `;
}
