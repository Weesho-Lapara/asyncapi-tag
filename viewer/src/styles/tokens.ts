import { css } from 'lit';

/**
 * Design tokens (spec 4.3). Public variables are `--asyncapi-*`, set on the element by the
 * theme file or page CSS. Each maps to a private `--_*` with the design default, so page CSS
 * wins whenever it sets a public one. Dark values apply through the reflected
 * `resolved-theme` attribute, so page CSS can scope overrides per mode.
 */
export const tokens = css`
  :host {
    --_primary: var(--asyncapi-primary, #2944c9);
    --_secondary: var(--asyncapi-secondary, #b84e1a);

    --_bg: var(--asyncapi-bg, #f6f5f1);
    --_surface: var(--asyncapi-surface, #ffffff);
    --_sidebar: var(--asyncapi-sidebar, #efede7);
    --_head: var(--asyncapi-head, #f8f7f3);
    --_ink: var(--asyncapi-ink, #17191f);
    --_ink-2: var(--asyncapi-ink-2, #3a3e48);
    --_muted: var(--asyncapi-muted, #5e626d);
    --_line: var(--asyncapi-line, #e3e0d8);
    --_line-2: var(--asyncapi-line-2, #c9c5ba);
    --_tint-strength: 10%;

    /* Example panel: the same in both themes. */
    --_ex-bg: #12141a;
    --_ex-ink: #dcdfe6;
    --_ex-muted: #8c92a0;
    --_ex-lines: #4a505c;
    --_ex-divider: #262a33;
    --_ex-heading: #f4f5f7;
    --_ex-number: #b7c4e8;

    --_font-heading: var(--asyncapi-font-heading, ui-sans-serif, system-ui, sans-serif);
    --_font-body: var(--asyncapi-font-body, ui-sans-serif, system-ui, sans-serif);
    --_font-mono: var(--asyncapi-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    --_radius: var(--asyncapi-radius, 10px);
    --_radius-sm: calc(var(--_radius) - 3px);
    --_example-width: clamp(360px, var(--asyncapi-example-width, 452px), 560px);

    /* Derived at runtime from the resolved accent (util/color.ts); these are the fallbacks. */
    --_badge-ink: #ffffff;
    --_primary-text: var(--_primary);
    --_secondary-text: var(--_secondary);
    --_tint: color-mix(in srgb, var(--_primary) var(--_tint-strength), transparent);
    --_logo: var(--asyncapi-logo, none);
  }

  :host([resolved-theme='dark']) {
    --_bg: var(--asyncapi-bg, #0f1115);
    --_surface: var(--asyncapi-surface, #161920);
    --_sidebar: var(--asyncapi-sidebar, #12151a);
    --_head: var(--asyncapi-head, #1b1f27);
    --_ink: var(--asyncapi-ink, #ecedef);
    --_ink-2: var(--asyncapi-ink-2, #c4c8d0);
    --_muted: var(--asyncapi-muted, #959ba7);
    --_line: var(--asyncapi-line, #262a33);
    --_line-2: var(--asyncapi-line-2, #3a404c);
    --_tint-strength: 20%;
    --_logo: var(--asyncapi-logo-dark, var(--asyncapi-logo, none));
  }
`;
