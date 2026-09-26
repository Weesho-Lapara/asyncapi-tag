# asyncapi-viewer (web component)

The browser side of `asyncapi-viewer`: a Lit web component that renders AsyncAPI 2 and 3 documents.
It knows nothing about MkDocs or Python. Its only interfaces are the `<asyncapi-viewer>` element and
its attributes, `options.schema.json`, and the CSS custom properties in `theme/asyncapi-theme.css`.

Work in progress on the `viewer-2` branch; see [ROADMAP.md](../ROADMAP.md) for the plan and
[specs/viewer-spec.md](../specs/viewer-spec.md) for the specification.

```sh
npm ci
npm run check   # tsc + eslint
npm test        # vitest
npm run build   # dist/asyncapi-viewer.js (ESM) and dist/asyncapi-viewer.iife.js
```

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
