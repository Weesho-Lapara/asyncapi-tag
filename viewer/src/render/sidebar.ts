/**
 * The sidebar (spec 4.9 and amendment 11): search, then the nav items grouped as configured,
 * with the current item highlighted. On narrow containers it is a drawer behind a menu button.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { filterNav, groupNav, type NavItem } from './nav.js';

export const sidebarStyles = css`
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .main {
    min-width: 0;
    container-type: inline-size;
    container-name: main;
  }
  @container viewer (min-width: 1100px) {
    .layout--sidebar {
      grid-template-columns: 292px minmax(0, 1fr);
    }
  }
  .side {
    background: var(--_sidebar);
    border-right: 1px solid var(--_line);
  }
  @container viewer (min-width: 1100px) {
    .side {
      position: sticky;
      top: 0;
      max-height: 100vh;
      overflow: auto;
    }
  }
  .side__inner {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 16px 12px 24px;
  }
  .side__block--components {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--_line);
  }
  .side__search {
    display: block;
    width: 100%;
    min-height: 40px;
    margin-bottom: 12px;
    padding: 0 12px;
    border: 1px solid var(--_line);
    border-radius: var(--_radius-sm);
    background: var(--_surface);
    color: var(--_ink);
    font: 13px/1 var(--_font-body);
  }
  .side__search:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 1px;
  }
  .side__group {
    display: flex;
    justify-content: space-between;
    margin: 18px 10px 6px;
    font: 500 11px/1 var(--_font-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--_muted);
  }
  .side__group .mono {
    letter-spacing: 0;
  }
  .side ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .side__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 8px;
    min-height: 44px;
    padding: 6px 10px;
    border-radius: var(--_radius-sm);
    color: var(--_ink);
    text-decoration: none;
    font-size: 13px;
    line-height: 1.35;
  }
  .side__item:hover {
    background: color-mix(in srgb, var(--_primary) 6%, transparent);
  }
  .side__item:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: -2px;
  }
  .side__item[aria-current='true'] {
    background: var(--_tint);
    font-weight: 600;
  }
  .side__item--section {
    font-weight: 500;
  }
  .side__badge {
    grid-row: 1 / span 2;
    height: 18px;
    padding: 0 6px;
    border-radius: 5px;
    font: 500 10px/18px var(--_font-mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .side__badge--send {
    background: var(--_send);
    color: var(--_badge-ink-send);
  }
  .side__badge--receive {
    background: var(--_receive);
    color: var(--_badge-ink-receive);
  }
  .side__label {
    grid-column: 2;
    overflow-wrap: anywhere;
  }
  .side__sub {
    grid-column: 2;
    font: 400 11.5px/1.4 var(--_font-mono);
    color: var(--_muted);
    overflow-wrap: anywhere;
  }
  .side__count {
    grid-column: 3;
    grid-row: 1;
    font: 400 12px/1 var(--_font-mono);
    color: var(--_muted);
  }
  .side__empty {
    margin: 8px 10px;
    color: var(--_muted);
    font-size: 13px;
  }
  .side__live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  /* Drawer (below 1100px). */
  .menu {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--_line);
    border-radius: var(--_radius-sm);
    background: var(--_surface);
    color: var(--_ink);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .menu:focus-visible {
    outline: 2px solid var(--_primary);
    outline-offset: 2px;
  }
  .menu svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  /* After the base rules so the wide-container reset wins on equal specificity. */
  @container viewer (min-width: 1100px) {
    .side__close,
    .menu {
      display: none;
    }
  }
  @container viewer (max-width: 1099px) {
    .side {
      display: none;
    }
    .layout--open .side {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 30;
      background: rgb(0 0 0 / 0.35);
      border: 0;
    }
    .side__panel {
      position: sticky;
      top: 0;
      width: 320px;
      max-width: calc(100% - 56px);
      height: 100vh;
      height: 100dvh;
      overflow: auto;
      background: var(--_sidebar);
      border-right: 1px solid var(--_line);
      box-shadow: 8px 0 24px rgb(0 0 0 / 0.12);
    }
    .side__close {
      display: inline-flex;
      margin: 12px 12px 0;
    }
  }
`;

export interface SidebarInput {
  items: NavItem[];
  query: string;
  keepSections: boolean;
  current: string | undefined;
  open: boolean;
  liveText: string;
  onQuery: (query: string) => void;
  onEscape: () => void;
  onChoose: () => void;
  onClose: () => void;
  id: string;
}

const closeIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>`;

export function renderSidebar(input: SidebarInput): TemplateResult {
  const filtered = filterNav(input.items, input.query, input.keepSections);
  const groups = groupNav(filtered.items);
  return html`<div
    class="side"
    id="${input.id}--sidebar"
    @click=${(e: Event) => {
      if (e.target === e.currentTarget) input.onClose();
    }}
  >
    <div class="side__panel" role=${input.open ? 'dialog' : nothing} aria-modal=${input.open ? 'true' : nothing} aria-label="Navigation">
      <button class="btn btn--icon side__close" type="button" aria-label="Close navigation" @click=${input.onClose}>${closeIcon}</button>
      <nav class="side__inner" aria-label="API navigation">
        <label class="visually-hidden" for="${input.id}--search">Search operations, channels</label>
        <input
          class="side__search"
          id="${input.id}--search"
          type="search"
          placeholder="Search operations, channels"
          autocomplete="off"
          .value=${input.query}
          @input=${(e: Event) => input.onQuery((e.target as HTMLInputElement).value)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            if (input.query !== '') input.onQuery('');
            else input.onEscape();
          }}
        />
        <span class="side__live" aria-live="polite">${input.liveText}</span>
        ${groups.map(
          (g) => html`<div class="side__block ${g.group === 'Components' ? 'side__block--components' : ''}">
            ${g.group !== undefined
              ? html`<div class="side__group">
                  <span>${g.group}</span>
                  ${g.group !== 'Components' ? html`<span class="mono">${g.items.length}</span>` : nothing}
                </div>`
              : nothing}
            <ul>
              ${g.items.map((item) => renderItem(item, input))}
            </ul>
          </div>`,
        )}
        ${filtered.active && filtered.shown === 0 ? html`<p class="side__empty">No operations match</p>` : nothing}
      </nav>
    </div>
  </div>`;
}

function renderItem(item: NavItem, input: SidebarInput): TemplateResult {
  const current = input.current === item.anchor;
  return html`<li>
    <a
      class="side__item ${item.kind === 'section' ? 'side__item--section' : ''}"
      href="#${item.anchor}"
      aria-current=${current ? 'true' : nothing}
      @click=${input.onChoose}
    >
      ${item.badge ? html`<span class="side__badge side__badge--${item.badge.action}">${item.badge.label}</span>` : nothing}
      <span class="side__label">${item.label}</span>
      ${item.count !== undefined ? html`<span class="side__count">${item.count}</span>` : nothing}
      ${item.sub ? html`<span class="side__sub">${item.sub}</span>` : nothing}
    </a>
  </li>`;
}

export const menuIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>`;
