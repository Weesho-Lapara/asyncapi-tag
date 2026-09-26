import { css, html, nothing, type TemplateResult } from 'lit';
import type { Document, Message, Operation } from '../model/types.js';
import { renderInline, renderMarkdown } from './markdown.js';
import { renderBindings, renderParameters, renderReply, renderSecurity } from './details.js';
import { examplesFor, isPanelOpen, renderExamplePanel, renderShowExample, type ExampleContext } from './example.js';
import { slug } from '../model/context.js';
import { schemaFormatLabel } from './format.js';
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
  .op + .op {
    padding-top: 40px;
    border-top: 1px solid var(--_line);
  }

  .op__content {
    min-width: 0;
  }
  .op__content > .block:first-child {
    margin-top: 0;
  }
  .op__example {
    margin-top: 24px;
  }
  .sub-title .ex__show {
    flex-basis: 100%;
    justify-content: center;
  }
  .op__desc .md p {
    font-size: 15px;
    line-height: 1.6;
  }
  /* Wide main column: the example panel is a full-height dark column at the right edge of the
     block, level with the breadcrumb (design reference). The split depends on the main
     column's width, so beside a sidebar the panel stacks until both have room. */
  @container main (min-width: 1100px) {
    .op--split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--_example-width);
      column-gap: 36px;
      margin-right: calc(-1 * var(--_pad-x));
    }
    .op--split .op__intro,
    .op--split .op__content {
      grid-column: 1;
    }
    .op--split .op__example {
      grid-column: 2;
      grid-row: 1 / span 2;
      margin-top: 0;
      background: var(--_ex-bg);
      border-radius: var(--_radius) 0 0 var(--_radius);
    }
    .op--split .op__example .ex {
      position: sticky;
      top: 0;
      border-radius: 0;
    }
  }
  /* Badge/id, CHANNEL/address and Available on/servers share two columns so the values line up. */
  .op__facts {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 16px;
  }
  .op__facts .label {
    font-size: 13px;
    letter-spacing: 0.06em;
  }
  .op__facts .badge {
    justify-self: start;
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
  .op__tags {
    margin-bottom: 14px;
  }
  .op__tags .chip {
    min-height: 24px;
    padding: 2px 9px;
    font-size: 12px;
  }
  .op__hint {
    font: 400 12.5px/1.4 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
  .op__heading {
    margin: 0 0 12px;
    font: 600 28px/1.2 var(--_font-heading);
    letter-spacing: -0.01em;
    color: var(--_ink);
    overflow-wrap: anywhere;
  }
  .op__id {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    font: 400 13px/1.5 var(--_font-mono);
    color: var(--_ink);
    overflow-wrap: anywhere;
  }
  @container viewer (max-width: 699px) {
    .op__heading {
      font-size: 22px;
    }
  }
  .op__heading:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 4px;
    border-radius: 2px;
  }
  .op__servers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
  }
  .op__server {
    font: 400 13px/1.5 var(--_font-mono);
    color: var(--_primary-text);
  }
  .op__address {
    font: 400 13px/1.5 var(--_font-mono);
    color: var(--_ink);
    word-break: break-all;
  }
  .op__address--none {
    color: var(--_muted);
    font-style: italic;
  }
  .param {
    color: var(--_primary-text);
  }
  .op__summary {
    margin: 0 0 12px;
  }
  .op__desc {
    max-width: 72ch;
  }
  .msg {
    margin-top: 32px;
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
  @container viewer (max-width: 699px) {
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

/** The address; `{parameters}` are set off in the accent colour, without links. */
export function renderAddress(op: Operation): TemplateResult {
  const address = op.channel.address;
  if (address === null) return html`<span class="op__address op__address--none">Address not specified</span>`;
  const parts = address.split(/(\{[^}]+\})/g).filter((s) => s !== '');
  return html`<span class="op__address">${parts.map((part) => (/^\{[^}]+\}$/.test(part) ? html`<span class="param">${part}</span>` : part))}</span>`;
}

function renderMessage(
  op: Operation,
  message: Message,
  anchor: string,
  index: number,
  ctx: OperationContext,
  showExample: TemplateResult | typeof nothing,
): TemplateResult {
  const treeKey = `${anchor}--m${index}`;
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
              ${m.id}
            </button>`,
          )}
        </div>`
      : nothing}
    <div id="${anchor}--message" role=${op.messages.length > 1 ? 'tabpanel' : nothing} aria-labelledby=${op.messages.length > 1 ? `${anchor}--tab-${index}` : nothing}>
      <h4 class="sub-title">
        Message <span class="mono">${message.title ?? message.name ?? message.id}</span>
        <span class="sub-title__meta">${message.contentType} · ${schemaFormatLabel(message.schemaFormat)}</span>
        ${showExample}
      </h4>
      ${message.summary ? html`<div class="msg__desc">${renderInline(message.summary)}</div>` : nothing}
      ${message.description ? html`<div class="msg__desc">${renderMarkdown(message.description)}</div>` : nothing}
      ${message.payload
        ? renderSchema(message.payload, { label: message.id, prefix: ctx.prefix, key: `${treeKey}--payload`, state: ctx.tree(`${treeKey}--payload`) })
        : html`<p class="tree__empty">This message has no payload schema.</p>`}
      ${message.headers
        ? html`<div class="msg__part">
            <h4 class="sub-title">Headers</h4>
            ${renderSchema(message.headers, { prefix: ctx.prefix, key: `${treeKey}--headers`, state: ctx.tree(`${treeKey}--headers`) })}
          </div>`
        : nothing}
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
        ${op.tags.length > 0
          ? html`<ul class="chips op__tags" aria-label="Tags">
              ${op.tags.map((t) => html`<li class="chip" title=${t.description ?? ''}>${t.name}</li>`)}
            </ul>`
          : nothing}
        <h3 class="op__heading" id="${anchor}--heading" tabindex="-1">${op.heading}</h3>
        <div class="op__facts">
          <span class="badge badge--${direction}">${op.badgeLabel}</span>
          <span class="op__id">
            ${op.id}
            ${op.locationHint !== op.id && op.locationHint !== op.heading ? html`<span class="op__hint">${op.locationHint}</span>` : nothing}
          </span>
          <span class="label">Channel</span>
          ${renderAddress(op)}
          ${op.channel.servers.length > 0
            ? html`<span class="label">Available on</span>
                <span class="op__servers">
                  ${op.channel.servers.map((id) => html`<a class="op__server" href="#${prefix}--servers--${slug(id)}">${id}</a>`)}
                </span>`
            : nothing}
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
              examples.length > 0 && !open ? renderShowExample(exampleCtx) : nothing,
            )
          : html`<p class="tree__empty block">This operation has no messages.</p>`}
        ${renderBindings(bindings)}
        ${renderSecurity(op.security, `#${prefix}--servers`)}
        ${op.reply ? renderReply(op.reply, prefix) : nothing}
      </div>
      ${open && message ? html`<div class="op__example">${renderExamplePanel(message, examples, exampleCtx, `${anchor}--example`)}</div>` : nothing}
    </article>
  `;
}

export function renderOperations(doc: Document, ctx: OperationContext): TemplateResult | typeof nothing {
  if (doc.operations.length === 0) return nothing;
  const id = `${ctx.prefix}--operations`;
  return html`
    <section class="ops" aria-labelledby=${id}>
      <h2 class="section-title" id=${id} tabindex="-1">Operations</h2>
      <div class="ops__list">${doc.operations.map((op) => renderOperation(op, ctx))}</div>
    </section>
  `;
}
