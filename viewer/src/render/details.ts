/**
 * Shared detail blocks: the Parameters table, binding chips, the security list and the reply
 * block (spec 4.7 items 5, 7, 8, 9). Servers reuse chips and security in chunk 1.14.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { Binding, Parameter, Reply, SecurityRequirement } from '../model/types.js';
import { renderInline } from './markdown.js';

export const detailStyles = css`
  .block {
    margin-top: 22px;
  }
  .block__title {
    margin: 0 0 10px;
    font: 500 11px/1 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_muted);
  }
  .block__title:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 4px;
  }
  .params {
    display: grid;
    grid-template-columns: 160px minmax(0, 1fr);
    gap: 12px 20px;
    margin: 0;
    padding: 14px 16px;
    border: 1px solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_surface);
  }
  .params dt {
    display: grid;
    gap: 2px;
    align-content: start;
  }
  .params__name {
    font: 500 13px/1.5 var(--_font-mono);
    color: var(--_primary-text);
    overflow-wrap: anywhere;
  }
  .params__schema {
    font: 400 11.5px/1.5 var(--_font-mono);
    color: var(--_muted);
  }
  .params dd {
    margin: 0;
    color: var(--_ink-2);
    font-size: 13px;
  }
  .params__facts {
    font: 400 11.5px/1.6 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
  @container viewer (max-width: 699px) {
    .params {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .params dd + dt {
      margin-top: 12px;
    }
  }
  .chip__scope {
    color: var(--_muted);
  }
  .chip__value {
    color: var(--_ink);
  }
  .chip pre {
    margin: 0;
    font: 11.5px/1.4 var(--_font-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-width: 48ch;
  }
  .sec {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .sec li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    font-size: 13px;
  }
  .sec__type {
    font: 400 12px/1.5 var(--_font-mono);
    color: var(--_muted);
  }
  .sec__scopes {
    font: 400 12px/1.5 var(--_font-mono);
    color: var(--_ink-2);
  }
  .sec__desc {
    flex-basis: 100%;
    color: var(--_ink-2);
    font-size: 12.5px;
  }
  .reply {
    padding: 14px 16px;
    border: 1px solid var(--_line);
    border-left: 3px solid var(--_secondary);
    border-radius: var(--_radius);
    background: var(--_surface);
    display: grid;
    gap: 8px;
  }
  .reply__row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
  }
  .reply__address {
    font: 400 14px/1.5 var(--_font-mono);
    color: var(--_ink);
    word-break: break-all;
  }
  .reply__messages {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .reply__desc {
    color: var(--_ink-2);
    font-size: 13px;
  }
`;

export function renderParameters(parameters: Parameter[], anchor: string): TemplateResult | typeof nothing {
  if (parameters.length === 0) return nothing;
  return html`<div class="block" id="${anchor}--parameters">
    <h4 class="block__title" tabindex="-1">Parameters</h4>
    <dl class="params">
      ${parameters.map((p) => {
        const facts: string[] = [];
        if (p.enum && p.enum.length > 0) facts.push(`enum: ${p.enum.join(' · ')}`);
        if (p.default !== undefined) facts.push(`default: ${p.default}`);
        if (p.examples && p.examples.length > 0) facts.push(`examples: ${p.examples.join(' · ')}`);
        if (p.location) facts.push(`location: ${p.location}`);
        return html`<dt>
            <span class="params__name">${p.name}</span>
            ${p.schemaType ? html`<span class="params__schema">schema: ${p.schemaType}</span>` : nothing}
          </dt>
          <dd>
            ${p.description ? html`<div>${renderInline(p.description)}</div>` : nothing}
            ${facts.length > 0 ? html`<div class="params__facts">${facts.join('  ·  ')}</div>` : nothing}
          </dd>`;
      })}
    </dl>
  </div>`;
}

function chipValue(value: unknown): TemplateResult {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return html`<span class="chip__value mono">${String(value)}</span>`;
  const text = JSON.stringify(value);
  if (text.length <= 40) return html`<span class="chip__value mono">${text}</span>`;
  return html`<pre class="chip__value">${JSON.stringify(value, null, 2)}</pre>`;
}

/** Chips reading `<scope>.<key> <value>`; empty when there are none. */
export function renderBindings(bindings: Binding[], title = 'Bindings'): TemplateResult | typeof nothing {
  if (bindings.length === 0) return nothing;
  return html`<div class="block">
    <h4 class="block__title">${title}</h4>
    <ul class="chips">
      ${bindings.map(
        (b) => html`<li class="chip" title="${b.protocol} binding">
          <span class="mono"><span class="chip__scope">${b.scope}.</span>${b.key}</span>
          ${chipValue(b.value)}
        </li>`,
      )}
    </ul>
  </div>`;
}

export function renderSecurity(security: SecurityRequirement[], serversHref: string): TemplateResult | typeof nothing {
  if (security.length === 0) return nothing;
  return html`<div class="block">
    <h4 class="block__title">Security</h4>
    <ul class="sec">
      ${security.map(
        (s) => html`<li>
          <a href=${serversHref}>${s.id}</a>
          ${s.type ? html`<span class="sec__type">${s.type}</span>` : nothing}
          ${s.scopes.length > 0 ? html`<span class="sec__scopes">scopes: ${s.scopes.join(', ')}</span>` : nothing}
          ${s.description ? html`<span class="sec__desc">${renderInline(s.description)}</span>` : nothing}
        </li>`,
      )}
    </ul>
  </div>`;
}

export function renderReply(reply: Reply, prefix: string): TemplateResult {
  const address = reply.channel ? reply.channel.address : undefined;
  return html`<div class="block">
    <h4 class="block__title">Reply</h4>
    <div class="reply">
      ${reply.addressLocation
        ? html`<div class="reply__row"><span class="label">Address from</span><span class="reply__address">${reply.addressLocation}</span></div>`
        : nothing}
      ${reply.addressDescription ? html`<div class="reply__desc">${renderInline(reply.addressDescription)}</div>` : nothing}
      ${reply.channel
        ? html`<div class="reply__row">
            <span class="label">Channel</span>
            <span class="reply__address">${address === null ? 'Address not specified' : address}</span>
            ${reply.channel.id !== address ? html`<span class="params__schema">${reply.channel.id}</span>` : nothing}
          </div>`
        : nothing}
      ${reply.messages.length > 0
        ? html`<div class="reply__row">
            <span class="label">Messages</span>
            <ul class="reply__messages">
              ${reply.messages.map((m) => html`<li><a class="chip" href="#${prefix}--messages--${m.anchor}">${m.title ?? m.name ?? m.id}</a></li>`)}
            </ul>
          </div>`
        : nothing}
    </div>
  </div>`;
}
