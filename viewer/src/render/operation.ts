import { css, html, nothing, type TemplateResult } from 'lit';
import type { Document, Message, Operation } from '../model/types.js';
import { renderInline, renderMarkdown } from './markdown.js';
import { renderSchema, type TreeState } from './tree.js';

export interface OperationContext {
  prefix: string;
  tree: (key: string) => TreeState;
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
    background: var(--_primary);
    color: var(--_badge-ink);
  }
  .badge--receive {
    background: var(--_secondary);
    color: var(--_badge-ink-secondary, #ffffff);
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

function renderMessage(message: Message, anchor: string, ctx: OperationContext): TemplateResult {
  return html`<div class="msg">
    <div class="msg__head">
      <span class="label">Message</span>
      <span class="msg__name">${message.title ?? message.name ?? message.id}</span>
      <span class="msg__format">${message.contentType} · ${message.schemaFormat}</span>
    </div>
    ${message.payload ? renderSchema(message.payload, { prefix: ctx.prefix, key: `${anchor}--payload`, state: ctx.tree(`${anchor}--payload`) }) : html`<p class="tree__empty">This message has no payload schema.</p>`}
  </div>`;
}

export function renderOperation(op: Operation, ctx: OperationContext): TemplateResult {
  const prefix = ctx.prefix;
  const anchor = operationAnchor(prefix, op);
  const first = op.messages[0];
  const direction = op.action === 'send' ? 'send' : 'receive';
  return html`
    <article class="op" id=${anchor} aria-labelledby="${anchor}--heading">
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
      ${first ? renderMessage(first, anchor, ctx) : nothing}
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
