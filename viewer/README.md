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
