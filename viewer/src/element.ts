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
  static override styles = [tokens, base, headerStyles, infoStyles, operationStyles, treeStyles];

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
    this.ownerDocument.defaultView?.removeEventListener('hashchange', this.#onHashChange);
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    this.#deriveColors();
  }

  protected override updated(): void {
    this.#scrollToHash();
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
    target.scrollIntoView({ block: 'start' });
    (target.querySelector<HTMLElement>('[tabindex="-1"]') ?? target).focus({ preventScroll: true });
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
    const bg = read('--_bg');
    const dark = this.#resolved === 'dark';
    const derived: Record<string, string> = {};
    if (primary) {
      derived['--_badge-ink'] = badgeInk(primary);
      if (bg) derived['--_primary-text'] = toHex(textSafe(primary, bg, dark));
    }
    if (secondary) {
      derived['--_badge-ink-secondary'] = badgeInk(secondary);
      if (bg) derived['--_secondary-text'] = toHex(textSafe(secondary, bg, dark));
    }
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
    if (src === undefined) return;
    const url = resolveUrl(src, this.ownerDocument.baseURI);
    const result = await loadDocument(url);
    if (this.#loadedSrc !== src) return; // src changed while loading
    this.#result = result;
    if (result.ok) {
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
    return html`
      ${renderHeader({
        doc: m,
        src: r.url,
        hasLogo: this.#hasLogo,
        themeToggle: o.themeToggle,
        resolvedTheme: this.#resolved,
        onToggleTheme: () => this.#theme.toggle(),
      })}
      <div class="content">
        ${o.info ? renderInfo(m, `${this.id}--info`) : nothing}
        ${o.operations ? renderOperations(m, { prefix: this.id, tree: this.#tree }) : nothing}
        ${o.errors && this.#problems.length > 0
          ? html`<section aria-labelledby="${this.id}--problems">
              <h2 class="section-title" id="${this.id}--problems" tabindex="-1">Problems</h2>
              <ul>${this.#problems.map((p) => html`<li><strong>${p.severity}</strong> at <code>${p.where}</code>: ${p.message}</li>`)}</ul>
            </section>`
          : nothing}
      </div>
    `;
  }
}

// Loading the script twice (two <script> tags, instant navigation) must be harmless.
if (!customElements.get('asyncapi-viewer')) {
  customElements.define('asyncapi-viewer', AsyncAPIViewerElement);
}
