/**
 * Markdown from the document (descriptions, summaries). HTML in the source is escaped, never
 * rendered (`html: false`), and no autolinking (`linkify: false`), per the spec decisions.
 */
import MarkdownIt from 'markdown-it';
import { html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });

// Links open in a new tab only when they leave the page; rel keeps the referrer private.
const defaultLinkOpen = md.renderer.rules['link_open'] ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules['link_open'] = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx]?.attrGet('href') ?? '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#')) {
    tokens[idx]!.attrSet('target', '_blank');
    tokens[idx]!.attrSet('rel', 'noopener');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(text: string | undefined, className = 'md'): TemplateResult | typeof nothing {
  if (text === undefined || text.trim() === '') return nothing;
  return html`<div class=${className}>${unsafeHTML(md.render(text))}</div>`;
}

/** Inline markdown (no wrapping paragraph), for summaries and short descriptions. */
export function renderInline(text: string | undefined): TemplateResult | typeof nothing {
  if (text === undefined || text.trim() === '') return nothing;
  return html`${unsafeHTML(md.renderInline(text))}`;
}
