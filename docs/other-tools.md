# Other tools

`asyncapi-tag` is a Python-Markdown extension first. The MkDocs plugin is a thin layer that resolves
document paths per page and reports problems through the MkDocs logger.

## Zensical

[Zensical](https://zensical.org/) reads `mkdocs.yml` but does not run MkDocs plugins. It does honour
`markdown_extensions`, so enable the extension there instead:

```yaml title="mkdocs.yml"
markdown_extensions:
  - asyncapi_tag
```

Relative `src` paths work: Zensical rewrites them per page like it does for links. Listing both
`plugins: [asyncapi-tag]` and `markdown_extensions: [asyncapi_tag]` is fine and lets one file build
under MkDocs and Zensical. This site is built that way, and a Zensical build runs in CI.

The differences from MkDocs are that a missing document is not reported at build time (the viewer
shows the error in place instead) and the plugin options are not available. To customise asset URLs
under Zensical, pass them as extension options:

```yaml title="mkdocs.yml"
markdown_extensions:
  - asyncapi_tag:
      viewer_js: https://cdn.example.com/asyncapi/index.js
      viewer_js_integrity: ''
```

## Plain Python-Markdown

```python
import markdown

html = markdown.markdown(text, extensions=["asyncapi_tag"])
```

Extension options, passed as `extension_configs={"asyncapi_tag": {...}}`:

| Option | Default | Description |
|---|---|---|
| `viewer_js`, `viewer_css` | pinned unpkg URLs | Where to load the viewer from |
| `viewer_js_integrity`, `viewer_css_integrity` | matching SRI hashes | Empty string omits the attribute |
| `load_assets` | `True` | Emit the loader with the first tag on a page |
| `url_resolver` | identity | Callable mapping `src` (and relative asset URLs) to what the browser fetches |
| `warn` | `logging` | Callable receiving warning messages |

Without a `url_resolver`, `src` is emitted as written and the browser resolves it relative to the
page URL. Use site-root-relative or absolute URLs, or supply a resolver, when pages live in
subdirectories.

## Material for MkDocs

Material's `navigation.instant` swaps page content without a full reload. The runner subscribes to
Material's `document$` observable and renders any new containers, so instant navigation works. This
site has it enabled.

## How it works

Each tag becomes a `<div class="asyncapi-tag">` carrying the document URL and the viewer
configuration as HTML-escaped data attributes. The first tag on a page also emits the viewer's
stylesheet and script and a short runner script. The runner fetches each document as text, hands it
to `AsyncApiStandalone.render`, and prints a visible error inside the container if fetching or
rendering fails.
