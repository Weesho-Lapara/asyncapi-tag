import { css } from 'lit';

/** Layout shell, typography and the shared small components (pills, chips, buttons). */
export const base = css`
  :host {
    display: block;
    container-type: inline-size;
    container-name: viewer;
    position: relative;
    z-index: 0;
    color: var(--_ink);
    background: var(--_bg);
    font: 14px/1.55 var(--_font-body);
    border-radius: var(--_radius);
    overflow: clip;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  a {
    color: var(--_primary-text);
  }
  code,
  .mono {
    font-family: var(--_font-mono);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* Content column padding: 36/44/48 desktop, 28/32/40 tablet, 20/16/32 phone (spec 4.5). */
  .content {
    padding: 36px 44px 48px;
  }
  @container viewer (max-width: 1099px) {
    .content {
      padding: 28px 32px 40px;
    }
  }
  @container viewer (max-width: 699px) {
    .content {
      padding: 20px 16px 32px;
    }
  }

  section + section {
    margin-top: 40px;
    padding-top: 32px;
    border-top: 1px solid var(--_line);
  }
  h2.section-title {
    font: 600 20px/1.3 var(--_font-heading);
    margin: 0 0 16px;
    color: var(--_ink);
  }
  h2.section-title:focus-visible,
  h3:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 4px;
  }
  .label {
    font: 500 11px/1 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_muted);
  }
  .summary {
    font-size: 16px;
    line-height: 1.6;
    color: var(--_ink-2);
    margin: 0;
  }

  /* Markdown from the document. */
  .md > :first-child {
    margin-top: 0;
  }
  .md > :last-child {
    margin-bottom: 0;
  }
  .md p,
  .md ul,
  .md ol {
    margin: 0 0 0.8em;
    color: var(--_ink-2);
  }
  .md code {
    font-size: 0.92em;
    padding: 0.1em 0.35em;
    background: var(--_head);
    border: 1px solid var(--_line);
    border-radius: var(--_radius-sm);
  }
  .md pre {
    padding: 12px 14px;
    overflow: auto;
    background: var(--_head);
    border: 1px solid var(--_line);
    border-radius: var(--_radius-sm);
  }
  .md pre code {
    padding: 0;
    border: 0;
    background: none;
  }

  /* Pills and chips. */
  .pill {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font: 500 12px/1 var(--_font-mono);
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .pill--tint {
    background: var(--_tint);
    color: var(--_primary-text);
  }
  .pill--outline {
    border: 1px solid var(--_line-2);
    color: var(--_muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 26px;
    padding: 3px 10px;
    border: 1px solid var(--_line);
    border-radius: 999px;
    background: var(--_surface);
    font-size: 12.5px;
    color: var(--_ink-2);
  }
  .chip .mono {
    font-size: 12px;
  }

  /* Icon and text buttons: 44px targets (spec 4.11). */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--_line);
    border-radius: var(--_radius-sm);
    background: var(--_surface);
    color: var(--_ink);
    font: 500 13px/1 var(--_font-body);
    cursor: pointer;
    text-decoration: none;
  }
  .btn:hover {
    border-color: var(--_line-2);
  }
  .btn:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 2px;
  }
  .btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .btn--icon {
    padding: 0;
  }

  /* Definition rows used by Info and Servers. */
  .facts {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 10px 20px;
    margin: 0;
  }
  .facts dt {
    font: 500 11px/1.6 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_muted);
    padding-top: 2px;
  }
  .facts dd {
    margin: 0;
    color: var(--_ink-2);
    overflow-wrap: anywhere;
  }
  @container viewer (max-width: 699px) {
    .facts {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .facts dd + dt {
      margin-top: 10px;
    }
  }

  .alert {
    margin: 0;
    padding: 14px 16px;
    border: 1px solid var(--_secondary);
    border-radius: var(--_radius-sm);
    background: color-mix(in srgb, var(--_secondary) 8%, var(--_surface));
    color: var(--_ink);
  }
  .alert code {
    overflow-wrap: anywhere;
  }
`;
