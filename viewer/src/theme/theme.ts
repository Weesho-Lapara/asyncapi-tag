/**
 * Theme mode resolution (spec 4.4).
 *
 * `auto` follows the host page: Material for MkDocs (`body[data-md-color-scheme="slate"]`),
 * then `html[data-theme="dark"]`, then `prefers-color-scheme`. All three are watched so the
 * viewer follows the site's own toggle live. The in-viewer toggle overrides the host for this
 * element only. The resolved mode is reflected as `resolved-theme="light|dark"` on the host so
 * page CSS can scope overrides to one mode.
 */
export type ThemeMode = 'auto' | 'light' | 'dark';
export type Resolved = 'light' | 'dark';

export class ThemeController {
  #mode: ThemeMode = 'auto';
  #override: Resolved | undefined;
  #resolved: Resolved = 'light';
  #observer: MutationObserver | undefined;
  #media: MediaQueryList | undefined;
  readonly #onMedia = () => this.#update();

  constructor(
    private readonly host: HTMLElement,
    private readonly onChange: (resolved: Resolved) => void,
  ) {}

  get resolved(): Resolved {
    return this.#resolved;
  }

  /** The option value; a change clears any toggle override. */
  set mode(mode: ThemeMode) {
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#override = undefined;
    this.#update();
  }

  /** The toggle button: flips the resolved mode for this element only. */
  toggle(): void {
    this.#override = this.#resolved === 'dark' ? 'light' : 'dark';
    this.#update();
  }

  connect(): void {
    const doc = this.host.ownerDocument;
    const win = doc.defaultView;
    if (win?.matchMedia) {
      this.#media = win.matchMedia('(prefers-color-scheme: dark)');
      this.#media.addEventListener('change', this.#onMedia);
    }
    this.#observer = new MutationObserver(() => this.#update());
    this.#observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    if (doc.body) this.#observer.observe(doc.body, { attributes: true, attributeFilter: ['data-md-color-scheme', 'class'] });
    this.#update();
  }

  disconnect(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#media?.removeEventListener('change', this.#onMedia);
    this.#media = undefined;
  }

  /** What the host page says, before any override. Exported for tests. */
  hostPreference(): Resolved {
    const doc = this.host.ownerDocument;
    const scheme = doc.body?.getAttribute('data-md-color-scheme');
    if (scheme) return scheme === 'slate' ? 'dark' : 'light';
    const dataTheme = doc.documentElement.getAttribute('data-theme');
    if (dataTheme === 'dark' || dataTheme === 'light') return dataTheme;
    return this.#media?.matches ? 'dark' : 'light';
  }

  #update(): void {
    const next = this.#override ?? (this.#mode === 'auto' ? this.hostPreference() : this.#mode);
    if (next === this.#resolved && this.host.getAttribute('resolved-theme') === next) return;
    this.#resolved = next;
    this.host.setAttribute('resolved-theme', next);
    this.onChange(next);
  }
}
