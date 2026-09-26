import { html, nothing, type TemplateResult } from 'lit';
import { css } from 'lit';
import type { Document } from '../model/types.js';

export interface HeaderInput {
  doc: Document;
  /** The original document URL. */
  src: string | undefined;
  /** Object URL holding the document exactly as fetched, for "Download spec". */
  downloadHref: string | undefined;
  hasLogo: boolean;
  themeToggle: boolean;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  /** Rendered into the right-hand group (server selector, chunk 1.14). */
  extra?: TemplateResult | typeof nothing;
}

export const headerStyles = css`
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 68px;
    padding: 12px 24px;
    background: var(--_surface);
    border-bottom: 1px solid var(--_line);
  }
  .header__logo {
    flex: none;
    width: 40px;
    height: 40px;
    background: var(--_logo) center / contain no-repeat;
  }
  .header__title {
    margin: 0;
    font: 600 18px/1.3 var(--_font-heading);
    color: var(--_ink);
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .header__pills {
    display: flex;
    gap: 6px;
    flex: none;
  }
  .header__spacer {
    flex: 1;
  }
  .header__actions {
    display: flex;
    gap: 8px;
    flex: none;
  }
  .btn__text {
    display: inline;
  }
  @container viewer (max-width: 1099px) {
    .btn__text {
      display: none;
    }
    .btn:not(.btn--icon) {
      padding: 0;
    }
  }
  @container viewer (max-width: 699px) {
    .header {
      padding: 10px 16px;
      gap: 10px;
    }
    .header__logo {
      width: 34px;
      height: 34px;
    }
    .header__title {
      font-size: 16px;
    }
    .header__pills {
      display: none;
    }
  }
`;

const downloadIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" /></svg>`;
const moonIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>`;
const sunIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>`;

export function renderHeader(input: HeaderInput): TemplateResult {
  const { doc } = input;
  const fileName = input.src ? (input.src.split('/').pop()?.split('?')[0] || 'asyncapi') : 'asyncapi';
  return html`
    <header class="header">
      ${input.hasLogo ? html`<span class="header__logo" aria-hidden="true"></span>` : nothing}
      <h2 class="header__title">${doc.title}</h2>
      <div class="header__pills">
        ${doc.version ? html`<span class="pill pill--tint">v${doc.version}</span>` : nothing}
        <span class="pill pill--outline">AsyncAPI ${doc.specVersion}</span>
      </div>
      <div class="header__spacer"></div>
      ${input.extra ?? nothing}
      <div class="header__actions">
        ${input.downloadHref
          ? html`<a class="btn" href=${input.downloadHref} download=${fileName} title="Download spec">${downloadIcon}<span class="btn__text">Download spec</span></a>`
          : nothing}
        ${input.themeToggle
          ? html`<button
              class="btn btn--icon"
              type="button"
              aria-label="Toggle dark theme"
              aria-pressed=${input.resolvedTheme === 'dark' ? 'true' : 'false'}
              @click=${input.onToggleTheme}
            >
              ${input.resolvedTheme === 'dark' ? sunIcon : moonIcon}
            </button>`
          : nothing}
      </div>
    </header>
  `;
}
