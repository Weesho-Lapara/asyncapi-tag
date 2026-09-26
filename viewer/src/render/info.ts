import { css, html, nothing, type TemplateResult } from 'lit';
import type { Document } from '../model/types.js';
import { renderInline, renderMarkdown } from './markdown.js';

export const infoStyles = css`
  .info__lead {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 12px;
    margin-bottom: 14px;
  }
  .info__title {
    margin: 0;
    font: 600 20px/1.3 var(--_font-heading);
  }
  .info__version {
    color: var(--_muted);
    font-family: var(--_font-mono);
    font-size: 13px;
  }
  .info__desc {
    margin-bottom: 20px;
    max-width: 72ch;
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
      <h2 class="section-title" id=${anchorId} tabindex="-1">Overview</h2>
      <div class="info__lead">
        <h3 class="info__title">${doc.title}</h3>
        ${doc.version ? html`<span class="info__version">v${doc.version}</span>` : nothing}
      </div>
      <div class="info__desc">${renderMarkdown(doc.description)}</div>
      ${facts.length > 0
        ? html`<dl class="facts">${facts.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`
        : nothing}
    </section>
  `;
}
