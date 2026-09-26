import { css, html, nothing, type TemplateResult } from 'lit';
import type { Document } from '../model/types.js';
import { renderInline, renderMarkdown } from './markdown.js';

export const infoStyles = css`
  .info__desc {
    margin-bottom: 20px;
    padding: 14px 18px;
    border-left: 3px solid var(--_primary);
    border-radius: 0 var(--_radius-sm) var(--_radius-sm) 0;
    background: var(--_surface);
  }
  .info__desc .md p {
    font-size: 15px;
    line-height: 1.65;
    color: var(--_ink);
  }
`;

export function renderInfo(doc: Document, anchorId: string): TemplateResult {
  const facts: Array<[string, TemplateResult | typeof nothing]> = [];
  if (doc.contact) {
    const c = doc.contact;
    facts.push([
      'Contact',
      html`${c.name ?? nothing}${c.name && (c.email || c.url) ? ' · ' : nothing}${c.email ? html`<a href="mailto:${c.email}">${c.email}</a>` : nothing}${c.email && c.url ? ' · ' : nothing}${c.url ? html`<a href=${c.url} target="_blank" rel="noopener">${c.url}</a>` : nothing}`,
    ]);
  }
  if (doc.license) {
    facts.push(['License', doc.license.url ? html`<a href=${doc.license.url} target="_blank" rel="noopener">${doc.license.name}</a>` : html`${doc.license.name}`]);
  }
  if (doc.termsOfService) facts.push(['Terms of service', html`<a href=${doc.termsOfService} target="_blank" rel="noopener">${doc.termsOfService}</a>`]);
  if (doc.externalDocs) {
    facts.push(['Documentation', html`<a href=${doc.externalDocs.url} target="_blank" rel="noopener">${doc.externalDocs.description ?? doc.externalDocs.url}</a>`]);
  }
  if (doc.defaultContentType) facts.push(['Default content type', html`<code>${doc.defaultContentType}</code>`]);
  if (doc.tags.length > 0) {
    facts.push([
      'Tags',
      html`<ul class="chips">
        ${doc.tags.map((t) => html`<li class="chip" title=${t.description ?? ''}>${t.name}${t.description ? html`<span class="visually-hidden">: ${renderInline(t.description)}</span>` : nothing}</li>`)}
      </ul>`,
    ]);
  }
  return html`
    <section class="info" aria-labelledby=${anchorId}>
      <h2 class="section-title visually-hidden" id=${anchorId} tabindex="-1">${doc.title}</h2>
      ${doc.description ? html`<div class="info__desc">${renderMarkdown(doc.description)}</div>` : nothing}
      ${facts.length > 0
        ? html`<dl class="facts">${facts.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`
        : nothing}
    </section>
  `;
}
