import { LitElement, css, html, nothing } from 'lit';
import { loadDocument, resolveUrl, type LoadResult } from './load/loader.js';
import { RefResolver } from './load/refs.js';
import type { Problem } from './model/types.js';
import { parseOptions, type Options } from './options.js';

/**
 * <asyncapi-viewer src="..."> renders an AsyncAPI document.
 *
 * Options are read from the element's attributes (see options.schema.json). Attributes are
 * watched with a MutationObserver rather than Lit properties because each option has several
 * accepted spellings and hand-written HTML lowercases camelCase names.
 *
 * Skeleton state: loads the document and shows its title or the load error. The model and the
 * sections arrive in later chunks.
 */
export class AsyncAPIViewerElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }
  `;

  #options: Options = parseOptions([]);
  #observer: MutationObserver | undefined;
  #loadedSrc: string | undefined;
  #result: LoadResult | undefined;
  #resolver: RefResolver | undefined;
  #problems: Problem[] = [];

  /** The validated options, re-read whenever an attribute changes. */
  get options(): Options {
    return this.#options;
  }

  /** The outcome of the last load, for tests and tooling. */
  get loadResult(): LoadResult | undefined {
    return this.#result;
  }

  /** Problems collected so far (reference loading; later normalisation too). */
  get problems(): readonly Problem[] {
    return this.#problems;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#readOptions();
    this.#observer = new MutationObserver(() => this.#readOptions());
    this.#observer.observe(this, { attributes: true });
  }

  override disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    super.disconnectedCallback();
  }

  #readOptions(): void {
    this.#options = parseOptions(this.getAttributeNames().map((n) => [n, this.getAttribute(n)] as const));
    this.requestUpdate();
    void this.#load();
  }

  async #load(): Promise<void> {
    const src = this.#options.src;
    if (src === this.#loadedSrc) return;
    this.#loadedSrc = src;
    this.#result = undefined;
    if (src === undefined) return;
    const url = resolveUrl(src, this.ownerDocument.baseURI);
    const result = await loadDocument(url);
    if (this.#loadedSrc !== src) return; // src changed while loading
    this.#result = result;
    this.#problems = [];
    this.#resolver = undefined;
    if (result.ok) {
      const resolver = new RefResolver(result.url, result.data);
      this.#problems = await resolver.preload();
      if (this.#loadedSrc !== src) return;
      this.#resolver = resolver;
    }
    this.requestUpdate();
  }

  override render() {
    const src = this.#options.src;
    if (src === undefined) return html`<p role="alert">asyncapi-viewer: the src attribute is missing.</p>`;
    const r = this.#result;
    if (!r) return html`<p>Loading ${src}…</p>`;
    if (!r.ok) return html`<p role="alert">Could not load ${r.url}: ${r.error.message}</p>`;
    const info = r.data['info'] as { title?: string; version?: string } | undefined;
    const docs = this.#resolver?.documents.size ?? 1;
    return html`<p>
      Loaded AsyncAPI ${r.specVersion} (${r.format}): ${info?.title ?? nothing} ${info?.version ?? nothing}
      · ${docs} document${docs === 1 ? '' : 's'} · ${this.#problems.length} problem${this.#problems.length === 1 ? '' : 's'}
    </p>
    ${this.#problems.length > 0 ? html`<ul>${this.#problems.map((p) => html`<li>${p.message} (at ${p.where})</li>`)}</ul>` : nothing}`;
  }
}

// Loading the script twice (two <script> tags, instant navigation) must be harmless.
if (!customElements.get('asyncapi-viewer')) {
  customElements.define('asyncapi-viewer', AsyncAPIViewerElement);
}
