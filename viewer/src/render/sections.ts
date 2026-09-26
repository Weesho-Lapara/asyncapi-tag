/**
 * Servers, Messages, Schemas and Problems sections (spec 4.10) and the server selector (4.6).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { Document, Message, Problem, Server } from '../model/types.js';
import { renderBindings, renderSecurity } from './details.js';
import { examplesFor, renderExamplePanel, type ExampleContext } from './example.js';
import { renderInline, renderMarkdown } from './markdown.js';
import { renderSchema, typeLabel, type TreeState } from './tree.js';

export const sectionStyles = css`
  .cards {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .card {
    min-width: 0;
    padding: 16px 18px;
    border: 1px solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_surface);
    scroll-margin-top: 16px;
  }
  .card__head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    margin-bottom: 8px;
  }
  .card__id {
    margin: 0;
    font: 600 15px/1.4 var(--_font-heading);
    color: var(--_ink);
  }
  .card__id:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 4px;
  }
  .card__meta {
    font: 400 12.5px/1.5 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .card__host {
    font: 400 14px/1.5 var(--_font-mono);
    color: var(--_ink);
    word-break: break-all;
    margin-bottom: 6px;
  }
  .card__desc {
    font-size: 13px;
    color: var(--_ink-2);
  }
  .vars {
    width: 100%;
    margin-top: 12px;
    border-collapse: collapse;
    font-size: 13px;
  }
  .vars th {
    text-align: left;
    font: 500 11px/1.6 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_muted);
    padding: 6px 10px 6px 0;
    border-bottom: 1px solid var(--_line);
  }
  .vars td {
    padding: 7px 10px 7px 0;
    vertical-align: top;
    border-bottom: 1px solid var(--_line);
    color: var(--_ink-2);
  }
  .vars tr:last-child td {
    border-bottom: 0;
  }
  .vars .mono {
    font-size: 12.5px;
  }
  .vars__name {
    color: var(--_primary-text);
  }
  .msg-example {
    margin-top: 16px;
  }
  details.entry {
    border: 1px solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_surface);
    scroll-margin-top: 16px;
  }
  details.entry + details.entry {
    margin-top: 10px;
  }
  details.entry > summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    min-height: 44px;
    padding: 10px 16px;
    cursor: pointer;
    list-style: none;
    font: 600 14px/1.5 var(--_font-mono);
    color: var(--_ink);
  }
  details.entry > summary::-webkit-details-marker {
    display: none;
  }
  details.entry > summary::before {
    content: '';
    width: 7px;
    height: 7px;
    margin-right: 2px;
    border-right: 1.5px solid var(--_muted);
    border-bottom: 1.5px solid var(--_muted);
    transform: rotate(-45deg);
    transition: transform 120ms;
    align-self: center;
  }
  details.entry[open] > summary::before {
    transform: rotate(45deg);
  }
  details.entry > summary:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: -2px;
    border-radius: var(--_radius);
  }
  .entry__body {
    padding: 0 16px 16px;
  }
  .entry__body .tree,
  .entry__body .raw {
    border-color: var(--_line);
  }
  .entry__body > .block:first-child {
    margin-top: 4px;
  }
  .entry__title {
    font: 600 14px/1.5 var(--_font-heading);
    color: var(--_ink);
  }
  .entry__host {
    margin-left: auto;
    word-break: break-all;
  }
  .entry__body .card__desc + .card__desc {
    margin-top: 6px;
  }
  .entry__body .vars {
    margin-top: 12px;
  }
  .entry__desc {
    padding: 0 16px 12px;
    font-size: 13px;
    color: var(--_ink-2);
  }
  .problems {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  .problems li {
    padding: 10px 14px;
    border: 1px solid var(--_line);
    border-left: 3px solid var(--_secondary);
    border-radius: var(--_radius-sm);
    background: var(--_surface);
    font-size: 13px;
    color: var(--_ink);
  }
  .problems li[data-severity='warning'] {
    border-left-color: var(--_line-2);
  }
  .problems__where {
    display: block;
    margin-top: 2px;
    font: 400 12px/1.5 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
`;

export interface SectionContext {
  prefix: string;
  tree: (key: string) => TreeState;
  example: (key: string) => ExampleContext;
}

function serverEntry(server: Server, prefix: string): TemplateResult {
  const anchor = `${prefix}--servers--${server.anchor}`;
  return html`<details class="entry" id=${anchor}>
    <summary>
      <span class="entry__title">${server.id}</span>
      <span class="card__meta">${server.protocol}${server.protocolVersion ? ` ${server.protocolVersion}` : ''}</span>
      <span class="card__meta entry__host">${server.hostDisplay || 'Host not specified'}</span>
    </summary>
    <div class="entry__body">
      ${server.title ? html`<div class="card__desc"><strong>${server.title}</strong></div>` : nothing}
      ${server.summary ? html`<div class="card__desc">${renderInline(server.summary)}</div>` : nothing}
      ${server.description ? html`<div class="card__desc">${renderMarkdown(server.description)}</div>` : nothing}
      ${server.variables.length > 0
        ? html`<table class="vars">
            <thead><tr><th>Variable</th><th>Enum</th><th>Default</th><th>Description</th></tr></thead>
            <tbody>
              ${server.variables.map(
                (v) => html`<tr>
                  <td class="mono vars__name">${v.name}</td>
                  <td class="mono">${v.enum?.join(' · ') ?? ''}</td>
                  <td class="mono">${v.default ?? ''}</td>
                  <td>${renderInline(v.description)}${v.examples ? html` <span class="card__meta">examples: ${v.examples.join(' · ')}</span>` : nothing}</td>
                </tr>`,
              )}
            </tbody>
          </table>`
        : nothing}
      ${renderSecurity(server.security, `#${anchor}`)}
      ${renderBindings(server.bindings)}
    </div>
  </details>`;
}

export function renderServers(doc: Document, prefix: string): TemplateResult | typeof nothing {
  if (doc.servers.length === 0) return nothing;
  const id = `${prefix}--servers`;
  return html`<section aria-labelledby=${id}>
    <h2 class="section-title" id=${id} tabindex="-1">Servers</h2>
    ${doc.servers.map((s) => serverEntry(s, prefix))}
  </section>`;
}

function messageEntry(message: Message, ctx: SectionContext, showExamples: boolean): TemplateResult {
  const anchor = `${ctx.prefix}--messages--${message.anchor}`;
  const examples = showExamples ? examplesFor(message) : [];
  const title = message.title ?? message.name ?? message.id;
  return html`<details class="entry" id=${anchor}>
    <summary>
      <span class="entry__title">${title}</span>
      ${message.name && message.name !== title ? html`<span class="card__meta">${message.name}</span>` : nothing}
      <span class="card__meta">${message.contentType} · ${message.schemaFormat}</span>
    </summary>
    ${message.summary ? html`<div class="entry__desc">${renderInline(message.summary)}</div>` : nothing}
    ${message.description ? html`<div class="entry__desc">${renderMarkdown(message.description)}</div>` : nothing}
    <div class="entry__body">
      ${message.payload
        ? html`<div class="block"><h4 class="block__title">Payload</h4>${renderSchema(message.payload, { prefix: ctx.prefix, key: `${anchor}--payload`, state: ctx.tree(`${anchor}--payload`) })}</div>`
        : nothing}
      ${message.headers
        ? html`<div class="block"><h4 class="block__title">Headers</h4>${renderSchema(message.headers, { prefix: ctx.prefix, key: `${anchor}--headers`, state: ctx.tree(`${anchor}--headers`) })}</div>`
        : nothing}
      ${examples.length > 0 ? html`<div class="msg-example">${renderExamplePanel(message, examples, ctx.example(`${anchor}--example`), `${anchor}--example`)}</div>` : nothing}
      ${renderBindings(message.bindings)}
    </div>
  </details>`;
}

export function renderMessages(doc: Document, ctx: SectionContext, showExamples: boolean): TemplateResult | typeof nothing {
  if (doc.messages.length === 0) return nothing;
  const id = `${ctx.prefix}--messages`;
  return html`<section aria-labelledby=${id}>
    <h2 class="section-title" id=${id} tabindex="-1">Messages</h2>
    ${doc.messages.map((m) => messageEntry(m, ctx, showExamples))}
  </section>`;
}

export function renderSchemas(doc: Document, ctx: SectionContext): TemplateResult | typeof nothing {
  if (doc.schemas.length === 0) return nothing;
  const id = `${ctx.prefix}--schemas`;
  return html`<section aria-labelledby=${id}>
    <h2 class="section-title" id=${id} tabindex="-1">Schemas</h2>
    ${doc.schemas.map((s) => {
      const anchor = `${ctx.prefix}--schemas--${s.anchor}`;
      const label = s.schema.kind === 'node' ? typeLabel(s.schema) : s.schema.schemaFormat;
      return html`<details class="entry" id=${anchor}>
        <summary><span class="entry__title mono">${s.id}</span> ${label ? html`<span class="card__meta">${label}</span>` : nothing}</summary>
        <div class="entry__body">${renderSchema(s.schema, { prefix: ctx.prefix, key: anchor, state: ctx.tree(anchor) })}</div>
      </details>`;
    })}
  </section>`;
}

export function renderProblems(problems: readonly Problem[], prefix: string): TemplateResult | typeof nothing {
  if (problems.length === 0) return nothing;
  const id = `${prefix}--problems`;
  return html`<section aria-labelledby=${id}>
    <h2 class="section-title" id=${id} tabindex="-1">Problems</h2>
    <ul class="problems">
      ${problems.map(
        (p) => html`<li data-severity=${p.severity}>
          ${p.message}
          <span class="problems__where">${p.severity} · at ${p.where}</span>
        </li>`,
      )}
    </ul>
  </section>`;
}
