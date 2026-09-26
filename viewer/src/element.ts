import { LitElement, css, html } from 'lit';
import { parseOptions, type Options } from './options.js';

/**
 * <asyncapi-viewer src="..."> renders an AsyncAPI document.
 *
 * Options are read from the element's attributes (see options.schema.json). Attributes are
 * watched with a MutationObserver rather than Lit properties because each option has several
 * accepted spellings and hand-written HTML lowercases camelCase names.
 *
 * Skeleton state: renders the parsed options. Loading and the sections arrive in later chunks.
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

  /** The validated options, re-read whenever an attribute changes. */
  get options(): Options {
    return this.#options;
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
  }

  override render() {
    return html`<pre>${JSON.stringify(this.#options, null, 2)}</pre>`;
  }
}

// Loading the script twice (two <script> tags, instant navigation) must be harmless.
if (!customElements.get('asyncapi-viewer')) {
  customElements.define('asyncapi-viewer', AsyncAPIViewerElement);
}
