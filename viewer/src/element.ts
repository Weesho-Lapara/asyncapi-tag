import { LitElement, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { loadDocument, resolveUrl, type LoadResult } from './load/loader.js';
import { RefResolver } from './load/refs.js';
import { normalize } from './model/normalize.js';
import type { Document, Problem } from './model/types.js';
import { parseOptions, type Options } from './options.js';
import { headerStyles, renderHeader } from './render/header.js';
import { infoStyles, renderInfo } from './render/info.js';
import { operationStyles, renderOperations } from './render/operation.js';
import { detailStyles } from './render/details.js';
import { exampleStyles, type ExampleContext, type ExamplePanelState } from './render/example.js';
import { buildNavItems, filterNav } from './render/nav.js';
import { renderMessages, renderProblems, renderSchemas, renderServers, sectionStyles } from './render/sections.js';
import { menuIcon, renderSidebar, sidebarStyles } from './render/sidebar.js';
import { TreeState, treeStyles } from './render/tree.js';
import { base } from './styles/base.js';
import { tokens } from './styles/tokens.js';
import { ThemeController, type Resolved } from './theme/theme.js';
import { badgeInk, parseColor, textSafe, toHex, type RGB } from './util/color.js';

let counter = 0;

/**
 * <asyncapi-viewer src="..."> renders an AsyncAPI document.
 *
 * Options are read from the element's attributes (see options.schema.json) and watched with a
 * MutationObserver, because each option has several accepted spellings and hand-written HTML
 * lowercases camelCase names. The theme controller reflects the resolved mode as
 * `resolved-theme` on the host. Derived colours (badge text, text-safe accents) are computed
 * from the resolved accent at runtime and set as private custom properties on the root.
 */
export class AsyncAPIViewerElement extends LitElement {
  static override styles = [tokens, base, headerStyles, infoStyles, operationStyles, treeStyles, exampleStyles, detailStyles, sectionStyles, sidebarStyles];

  #options: Options = parseOptions([]);
  #observer: MutationObserver | undefined;
  #loadedSrc: string | undefined;
  #result: LoadResult | undefined;
  #model: Document | undefined;
  #problems: Problem[] = [];
  #resolved: Resolved = 'light';
  #derived: Record<string, string> = {};
  #hasLogo = false;
  #hashHandled: string | undefined;
  readonly #trees = new Map<string, TreeState>();
  readonly #tree = (key: string): TreeState => {
    let state = this.#trees.get(key);
    if (!state) {
      state = new TreeState(() => this.requestUpdate());
      this.#trees.set(key, state);
    }
    return state;
  };
  readonly #messageIndex = new Map<string, number>();
  #downloadUrl: string | undefined;
  #query = '';
  #drawerOpen = false;
  #current: string | undefined;
  #liveText = '';
  #liveTimer: ReturnType<typeof setTimeout> | undefined;
  #intersection: IntersectionObserver | undefined;
  #visible = new Set<string>();
  readonly #panels = new Map<string, ExamplePanelState>();
  readonly #example = (key: string): ExampleContext => {
    let state = this.#panels.get(key);
    if (!state) {
      state = { tab: 'payload', index: 0, open: undefined, copied: undefined };
      this.#panels.set(key, state);
    }
    return { state, defaultOpen: this.#options.messageExamples, onChange: () => this.requestUpdate() };
  };
  readonly #onHashChange = () => {
    this.#hashHandled = undefined;
    this.#scrollToHash();
  };
  readonly #theme = new ThemeController(this, (resolved) => this.#onTheme(resolved));

  /** The validated options, re-read whenever an attribute changes. */
  get options(): Options {
    return this.#options;
  }

  /** The outcome of the last load, for tests and tooling. */
  get loadResult(): LoadResult | undefined {
    return this.#result;
  }

  /** Problems collected so far (reference loading and normalisation). */
  get problems(): readonly Problem[] {
    return this.#problems;
  }

  /** The normalised model, once loaded. */
  get model(): Document | undefined {
    return this.#model;
  }

  /** The element id used as the anchor prefix; generated when the tag has none. */
  get anchorPrefix(): string {
    return this.id;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.id) this.id = `asyncapi-viewer-${++counter}`;
    this.#readOptions();
    this.#observer = new MutationObserver(() => this.#readOptions());
    this.#observer.observe(this, { attributes: true });
    this.#theme.connect();
    this.ownerDocument.defaultView?.addEventListener('hashchange', this.#onHashChange);
  }

  override disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#theme.disconnect();
    this.#intersection?.disconnect();
    this.#intersection = undefined;
    this.ownerDocument.defaultView?.removeEventListener('hashchange', this.#onHashChange);
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    this.#deriveColors();
  }

  protected override updated(): void {
    this.#scrollToHash();
    this.#observeSections();
  }

  /**
   * Spec 4.9: the sidebar highlights the block currently in view. Observed targets are the
   * section headings and operation blocks; the first visible one in document order wins.
   */
  #observeSections(): void {
    if (!this.#options.sidebar || !this.#model) {
      this.#intersection?.disconnect();
      this.#intersection = undefined;
      return;
    }
    const root = this.renderRoot as ShadowRoot;
    // The Operations section wrapper is skipped: its articles are the items, and the wrapper
    // would otherwise be "visible" whenever any of them is.
    const targets = [...root.querySelectorAll<HTMLElement>('section[aria-labelledby]:not(.ops), article.op')];
    this.#intersection?.disconnect();
    this.#visible.clear();
    this.#intersection = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id || e.target.getAttribute('aria-labelledby') || '';
          if (e.isIntersecting) this.#visible.add(id);
          else this.#visible.delete(id);
        }
        const order = targets.map((t) => t.id || t.getAttribute('aria-labelledby') || '');
        const first = order.find((id) => this.#visible.has(id));
        if (first !== this.#current) {
          this.#current = first;
          this.requestUpdate();
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0 },
    );
    for (const t of targets) this.#intersection.observe(t);
  }

  #setQuery(query: string, shown: number, total: number): void {
    this.#query = query;
    clearTimeout(this.#liveTimer);
    this.#liveTimer = setTimeout(() => {
      this.#liveText = query.trim() === '' ? '' : `${shown} of ${total} operations shown`;
      this.requestUpdate();
    }, 300);
    this.requestUpdate();
  }

  #openDrawer(): void {
    this.#drawerOpen = true;
    this.requestUpdate();
    this.updateComplete.then(() => (this.renderRoot as ShadowRoot).querySelector<HTMLInputElement>('.side__search')?.focus()).catch(() => undefined);
  }

  /** Close the drawer; focus returns to the menu button unless an item was chosen (amendment 10). */
  #closeDrawer(chosen = false): void {
    if (!this.#drawerOpen) return;
    this.#drawerOpen = false;
    this.requestUpdate();
    if (!chosen) {
      this.updateComplete.then(() => (this.renderRoot as ShadowRoot).querySelector<HTMLButtonElement>('.menu')?.focus()).catch(() => undefined);
    }
  }

  /** Keep Tab inside the open drawer. */
  #trapFocus(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !this.#drawerOpen) return;
    const panel = (this.renderRoot as ShadowRoot).querySelector<HTMLElement>('.side__panel');
    if (!panel) return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('a[href], button, input, select, [tabindex="0"]')].filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = (this.renderRoot as ShadowRoot).activeElement;
    if (e.shiftKey && active === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && active === last) {
      first.focus();
      e.preventDefault();
    }
  }

  /** Spec 4.11: a URL hash naming an anchor inside this viewer scrolls to it and focuses it. */
  #scrollToHash(): void {
    const hash = this.ownerDocument.defaultView?.location.hash ?? '';
    if (!this.#model || hash.length < 2 || hash === this.#hashHandled) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id.startsWith(`${this.id}--`)) return;
    const target = (this.renderRoot as ShadowRoot).getElementById(id) ?? (this.renderRoot as ShadowRoot).getElementById(`${id}--heading`);
    if (!target) return;
    this.#hashHandled = hash;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ block: 'start' });
    (target.querySelector<HTMLElement>('[tabindex="-1"], summary') ?? target).focus({ preventScroll: true });
  }

  #readOptions(): void {
    this.#options = parseOptions(this.getAttributeNames().map((n) => [n, this.getAttribute(n)] as const));
    this.#theme.mode = this.#options.theme;
    this.requestUpdate();
    void this.#load();
  }

  #onTheme(resolved: Resolved): void {
    this.#resolved = resolved;
    // Colours depend on the mode (background changes), so re-derive after the styles apply.
    this.updateComplete.then(() => this.#deriveColors()).catch(() => undefined);
    this.requestUpdate();
  }

  /**
   * Read the resolved accents and background through a probe element, then compute badge
   * text colour and text-safe accents (spec 4.2). Also detects whether a logo is configured.
   */
  #deriveColors(): void {
    const root = this.renderRoot as ShadowRoot | null;
    const probe = root?.querySelector<HTMLElement>('.probe');
    if (!probe) return;
    const read = (property: string): RGB | undefined => {
      probe.style.color = `var(${property})`;
      return parseColor(getComputedStyle(probe).color);
    };
    const primary = read('--_primary');
    const secondary = read('--_secondary');
    const send = read('--_send');
    const receive = read('--_receive');
    const bg = read('--_bg');
    const dark = this.#resolved === 'dark';
    const derived: Record<string, string> = {};
    if (primary && bg) derived['--_primary-text'] = toHex(textSafe(primary, bg, dark));
    if (secondary && bg) derived['--_secondary-text'] = toHex(textSafe(secondary, bg, dark));
    if (send) derived['--_badge-ink-send'] = badgeInk(send);
    if (receive) derived['--_badge-ink-receive'] = badgeInk(receive);
    const logo = getComputedStyle(this).getPropertyValue('--_logo').trim();
    const hasLogo = logo !== '' && logo !== 'none';
    if (hasLogo !== this.#hasLogo || JSON.stringify(derived) !== JSON.stringify(this.#derived)) {
      this.#hasLogo = hasLogo;
      this.#derived = derived;
      this.requestUpdate();
    }
  }

  async #load(): Promise<void> {
    const src = this.#options.src;
    if (src === this.#loadedSrc) return;
    this.#loadedSrc = src;
    this.#result = undefined;
    this.#model = undefined;
    this.#problems = [];
    this.#trees.clear();
    this.#panels.clear();
    this.#messageIndex.clear();
    this.#query = '';
    this.#drawerOpen = false;
    this.#current = undefined;
    if (this.#downloadUrl) URL.revokeObjectURL(this.#downloadUrl);
    this.#downloadUrl = undefined;
    if (src === undefined) return;
    const url = resolveUrl(src, this.ownerDocument.baseURI);
    const result = await loadDocument(url);
    if (this.#loadedSrc !== src) return; // src changed while loading
    this.#result = result;
    if (result.ok) {
      // Download spec serves the document exactly as fetched, whatever its origin.
      this.#downloadUrl = URL.createObjectURL(new Blob([result.text], { type: result.format === 'json' ? 'application/json' : 'application/yaml' }));
      const resolver = new RefResolver(result.url, result.data);
      const problems = await resolver.preload();
      if (this.#loadedSrc !== src) return;
      const o = this.#options;
      this.#model = normalize({
        resolver,
        data: result.data,
        specVersion: result.specVersion,
        specMajor: result.specMajor,
        problems,
        options: {
          labels: { publish: o.publishLabel, subscribe: o.subscribeLabel, send: o.sendLabel, receive: o.receiveLabel, request: o.requestLabel, reply: o.replyLabel },
          useChannelAddressAsIdentifier: o.useChannelAddressAsIdentifier,
          applyTraits: o.parserOptions.applyTraits,
        },
      });
      this.#problems = this.#model.problems;
    }
    this.requestUpdate();
  }

  override render() {
    return html`<div class="root" style=${styleMap(this.#derived)}>
      <span class="probe visually-hidden" aria-hidden="true"></span>
      ${this.#renderBody()}
    </div>`;
  }

  #renderBody() {
    const src = this.#options.src;
    if (src === undefined) return html`<div class="content"><p class="alert" role="alert">This viewer has no <code>src</code> attribute, so there is nothing to show.</p></div>`;
    const r = this.#result;
    if (!r) return html`<div class="content"><p class="summary">Loading ${src}…</p></div>`;
    if (!r.ok) {
      return html`<div class="content">
        <p class="alert" role="alert">Could not load <code>${r.url}</code>: ${r.error.message}</p>
      </div>`;
    }
    const m = this.#model;
    if (!m) return html`<div class="content"><p class="summary">Preparing ${src}…</p></div>`;
    const o = this.#options;
    const operations = m.operations;
    const sectionCtx = { prefix: this.id, tree: this.#tree, example: this.#example };
    const navItems = o.sidebar
      ? buildNavItems(m, operations, this.id, {
          info: o.info,
          servers: o.servers,
          messages: o.messages,
          schemas: o.schemas,
          showServers: o.showServers,
          showOperations: o.showOperations,
        })
      : [];
    const filtered = filterNav(navItems, this.#query, o.searchKeepSections);
    const menu = o.sidebar
      ? html`<button
          class="menu"
          type="button"
          aria-label="Open navigation"
          aria-expanded=${this.#drawerOpen ? 'true' : 'false'}
          aria-controls="${this.id}--sidebar"
          @click=${() => (this.#drawerOpen ? this.#closeDrawer() : this.#openDrawer())}
        >
          ${menuIcon}
        </button>`
      : nothing;
    const main = html`
      ${renderHeader({
        doc: m,
        src: r.url,
        downloadHref: this.#downloadUrl,
        hasLogo: this.#hasLogo,
        themeToggle: o.themeToggle,
        resolvedTheme: this.#resolved,
        onToggleTheme: () => this.#theme.toggle(),
        menu,
      })}
      <div class="content">
        ${o.info ? renderInfo(m, `${this.id}--info`) : nothing}
        ${o.servers ? renderServers(m, this.id) : nothing}
        ${o.operations
          ? renderOperations(m, {
              ...sectionCtx,
              messageIndex: (anchor) => this.#messageIndex.get(anchor) ?? 0,
              selectMessage: (anchor, index) => {
                this.#messageIndex.set(anchor, index);
                this.requestUpdate();
              },
            })
          : nothing}
        ${o.messages ? renderMessages(m, sectionCtx, o.showMessageExamples) : nothing}
        ${o.schemas ? renderSchemas(m, sectionCtx) : nothing}
        ${o.errors ? renderProblems(this.#problems, this.id) : nothing}
      </div>
    `;
    if (!o.sidebar) return html`<div class="layout"><div class="main">${main}</div></div>`;
    return html`<div
      class="layout layout--sidebar ${this.#drawerOpen ? 'layout--open' : ''}"
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.#drawerOpen && !(e.target as HTMLElement).classList?.contains('side__search')) {
          this.#closeDrawer();
          e.preventDefault();
        }
        this.#trapFocus(e);
      }}
    >
      ${renderSidebar({
        items: navItems,
        query: this.#query,
        keepSections: o.searchKeepSections,
        current: this.#current,
        open: this.#drawerOpen,
        liveText: this.#liveText,
        onQuery: (q) => this.#setQuery(q, filterNav(navItems, q, o.searchKeepSections).shown, filtered.total),
        onEscape: () => this.#closeDrawer(),
        onChoose: () => this.#closeDrawer(true),
        onClose: () => this.#closeDrawer(),
        id: this.id,
      })}
      <div class="main" ?inert=${this.#drawerOpen}>${main}</div>
    </div>`;
  }
}

// Loading the script twice (two <script> tags, instant navigation) must be harmless.
if (!customElements.get('asyncapi-viewer')) {
  customElements.define('asyncapi-viewer', AsyncAPIViewerElement);
}
