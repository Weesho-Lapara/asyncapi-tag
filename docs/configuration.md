# Configuration

## Plugin options

```yaml title="mkdocs.yml"
plugins:
  - asyncapi-tag:
      load_assets: true              # emit the viewer script and stylesheet (default: true)
      embed_css: true                # keep the viewer inside its container (default: true)
      viewer_js: https://unpkg.com/@asyncapi/react-component@3.2.1/browser/standalone/index.js
      viewer_js_integrity: sha384-…  # set to '' to omit the integrity attribute
      viewer_css: https://unpkg.com/@asyncapi/react-component@3.2.1/styles/default.min.css
      viewer_css_integrity: sha384-…
```

The defaults point at the pinned version listed in the [changelog](changelog.md) and carry
matching Subresource Integrity hashes, so a modified or substituted bundle is refused by the browser.

## Self-hosting the viewer

For air-gapped builds, or when your Content Security Policy does not allow `unpkg.com`, copy the two
files into `docs/` and point the options at them. Plugin-level paths are relative to `docs/` and are
resolved per page like `src` is:

```yaml title="mkdocs.yml"
plugins:
  - asyncapi-tag:
      viewer_js: assets/asyncapi/index.js
      viewer_js_integrity: ''
      viewer_css: assets/asyncapi/default.min.css
      viewer_css_integrity: ''
```

Download the files for the pinned version from unpkg or jsDelivr, for example:

```sh
curl -L -o docs/assets/asyncapi/index.js \
  https://unpkg.com/@asyncapi/react-component@3.2.1/browser/standalone/index.js
curl -L -o docs/assets/asyncapi/default.min.css \
  https://unpkg.com/@asyncapi/react-component@3.2.1/styles/default.min.css
```

You can keep integrity checking for self-hosted files too: compute the hash and set it.

```sh
openssl dgst -sha384 -binary docs/assets/asyncapi/index.js | openssl base64 -A
```

## Layout inside a documentation column

The viewer is built for a full-width page. In a narrower container it switches to a compact layout
whose sidebar toggle and sidebar overlay are positioned relative to the browser window, and whose
centre panel does not shrink below its content. The plugin emits a small stylesheet that keeps all
of that inside the viewer's box (`embed_css: true`, the default). Set it to `false` if you style the
viewer yourself; the rules are available as `asyncapi_tag.assets.EMBED_CSS`.

## Loading assets yourself

Set `load_assets: false` if you prefer to load the viewer through `extra_javascript` and `extra_css`.
The page-side runner script is still required in that case; it is available as
`asyncapi_tag.assets.RUNNER_JS`.

## Content Security Policy

With the defaults, pages need to allow:

- `script-src https://unpkg.com` plus an inline script (the runner). If you cannot allow inline
  scripts, use `load_assets: false` and ship the runner as a file.
- `style-src https://unpkg.com` and inline styles (the viewer injects some).
- `connect-src` for wherever your AsyncAPI documents live (`'self'` for files under `docs/`).

Self-hosting the viewer removes the `unpkg.com` entries.

## Security notes

- The viewer version is pinned and verified; it never floats to `@latest`.
- Nothing from your Markdown is interpolated into JavaScript. Attribute values are HTML-escaped
  into `data-asyncapi-*` attributes on the container and parsed by a fixed runner script.
- The build never fetches documents; the browser does, from the URL the plugin resolved.
- A new viewer release is picked up by a weekly workflow that re-pins the version and hashes, runs the
  test suite and opens a pull request for review.
