# asyncapi-viewer (web component)

The browser side of `asyncapi-viewer`: a Lit web component that renders AsyncAPI 2 and 3 documents.
It knows nothing about MkDocs or Python. Its only interfaces are the `<asyncapi-viewer>` element and
its attributes, `options.schema.json`, and the CSS custom properties in `theme/asyncapi-theme.css`.

Work in progress on the `viewer-2` branch; see [ROADMAP.md](../ROADMAP.md) for the plan and
[specs/viewer-spec.md](../specs/viewer-spec.md) for the specification.

```sh
npm ci
npm run check         # tsc + eslint
npm test              # vitest: options, loader, resolver, normalisers, schema builder, generator
npm run build         # dist/asyncapi-viewer.js (ESM) and dist/asyncapi-viewer.iife.js
npm run coverage      # normaliser over the AsyncAPI example corpus -> test/coverage/REPORT.md
npm run e2e:install   # Playwright browsers (once)
npm run e2e           # Playwright: axe-core accessibility, CSP page, screenshot capture
npm run sync-examples # refresh demo/spec-examples/ from the coverage corpus (after npm run coverage)
```

The demo at `demo/index.html` is a visual test bench: one viewer, a dropdown of every
asyncapi/spec example (a verbatim copy under `demo/spec-examples/`, listed by its
`index.json`), the docs examples and every test fixture, option checkboxes and a width switch.
Serve the repository root (`node scripts/serve.mjs`, or any static server) and open
`/viewer/demo/`; `?doc=<path>` selects a document.

## Browser suite (Playwright)

- `test/e2e/a11y.spec.ts`: axe-core over the demo at 1280 and 380px in light and dark, with
  the drawer open on the narrow width; fails on serious or critical violations. Plus a keyboard
  walk through the drawer and a tree toggle.
- `test/e2e/csp.spec.ts`: `test/e2e/csp/` is served with
  `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'` and must render
  fully with no CSP console errors. Result on 2026-09-26: Chromium and WebKit pass locally,
  Firefox passes in CI (Playwright's Firefox build does not launch on this macOS version).
  Lit's constructed stylesheets and the CSSOM writes for derived colours are allowed under a
  strict `style-src`; a `style` attribute binding was not, and was removed.
- `test/e2e/screenshots.spec.ts`: captures every example document at 1280, 820 and 380px in
  both themes into `test/e2e/screenshots/<browser>/` (ignored by git, uploaded as a CI
  artifact) and asserts no horizontal overflow. Pixel comparison across platforms is not
  attempted.

`dist/` is never committed. The Python package copies the built files at build time.

## Bundle size log (gzipped IIFE)

| Date | Chunk | Size |
|---|---|---|
| 2026-09-26 | 0.2 skeleton (Lit only) | 6.0 kB |
| 2026-09-26 | 1.2 loader (`yaml` added) | 38.6 kB |
| 2026-09-26 | 1.4 v3 normaliser and schema builder | 45.1 kB |
| 2026-09-26 | 1.5 v2 normaliser | 46.3 kB |
| 2026-09-26 | 1.6 schema tree builder complete | 46.9 kB |
| 2026-09-26 | 1.7 traits and problems | 47.2 kB |
| 2026-09-26 | 1.9 UI foundation (markdown-it added) | 93.8 kB |
| 2026-09-26 | 1.10 operation block, part 1 | 94.7 kB |
| 2026-09-26 | 1.11 payload tree | 97.4 kB |
| 2026-09-26 | 1.12 example panel and generator | 100.9 kB |
| 2026-09-26 | 1.13 operation block, part 2 | 102.5 kB |
| 2026-09-26 | 1.14 remaining sections | 104.3 kB |
| 2026-09-26 | 1.15 sidebar and drawer | 107.0 kB |
| 2026-09-26 | 1.16 breakpoints verified | 107.1 kB |
| 2026-09-26 | 1.17/1.18 review round, Avro, Playwright | 109.5 kB |
