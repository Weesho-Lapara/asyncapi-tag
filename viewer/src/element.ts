import { LitElement, css, html } from 'lit';

/**
 * <asyncapi-viewer src="..."> renders an AsyncAPI document.
 *
 * Chunk 0.2 skeleton: renders the `src` attribute as text. Loading, the model and the
 * sections arrive in later chunks (see ROADMAP.md).
 */
export class AsyncAPIViewerElement extends LitElement {
  // Reactive properties are declared statically (no decorators), so the build needs no
  // decorator transform and the class works the same when loaded as ESM or IIFE.
  static override properties = {
    src: { type: String },
  };

  declare src: string | undefined;

  static override styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }
  `;

  override render() {
    return html`<p>asyncapi-viewer: ${this.src ?? '(no src attribute)'}</p>`;
  }
}

// Loading the script twice (two <script> tags, instant navigation) must be harmless.
if (!customElements.get('asyncapi-viewer')) {
  customElements.define('asyncapi-viewer', AsyncAPIViewerElement);
}
