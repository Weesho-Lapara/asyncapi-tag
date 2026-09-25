# asyncapi-viewer

Render [AsyncAPI](https://www.asyncapi.com/) documents inside Markdown pages with a single element:

```html
<asyncapi-viewer src="asyncapi.yaml"></asyncapi-viewer>
```

`asyncapi-viewer` is a [Python-Markdown](https://python-markdown.github.io/) extension, so it works in
any tool built on Python-Markdown. It ships with a plugin for [MkDocs](https://www.mkdocs.org/)
that resolves document paths the same way MkDocs resolves links. Rendering in the browser is done
by the official [AsyncAPI React component](https://github.com/asyncapi/asyncapi-react), pinned to
an exact version and loaded with Subresource Integrity. JSON and YAML documents both work.

**Documentation and live demo:** https://weesho-lapara.github.io/asyncapi-viewer/

> Formerly published as `asyncapi-tag` (and before that `mkdocs-asyncapi-tag-plugin`). See [Migrating](#migrating-from-older-names).

## MkDocs

```sh
pip install asyncapi-viewer
```

```yaml
# mkdocs.yml
plugins:
  - asyncapi-viewer
```

Put your AsyncAPI file anywhere under `docs/` and reference it from a page. Paths are relative to
the Markdown file, or relative to `docs/` when they start with `/`. Absolute `http(s)://` URLs are
passed through unchanged.

```markdown
<!-- docs/api/events.md -->
# Events API

<asyncapi-viewer src="events.yaml" sidebar="false"></asyncapi-viewer>
```

Prefer plain Markdown over raw HTML? The same thing as a fenced block, with the attribute names as
`key: value` lines (the path may also follow the language):

````markdown
```asyncapi
src: events.yaml
sidebar: false
```
````

A missing document or an invalid attribute is reported as a MkDocs warning, so `mkdocs build
--strict` fails instead of shipping a broken page.

### Plugin options

```yaml
plugins:
  - asyncapi-viewer:
      load_assets: true              # emit the viewer script and stylesheet (default: true)
      embed_css: true                # keep the viewer inside its container (default: true)
      viewer_js: https://unpkg.com/@asyncapi/react-component@3.2.1/browser/standalone/index.js
      viewer_js_integrity: sha384-…  # set to '' to omit the integrity attribute
      viewer_css: https://unpkg.com/@asyncapi/react-component@3.2.1/styles/default.min.css
      viewer_css_integrity: sha384-…
```

To self-host the viewer, copy the two files into `docs/` and point the options at them.
Relative paths are resolved per page like `src` is:

```yaml
plugins:
  - asyncapi-viewer:
      viewer_js: assets/asyncapi/index.js
      viewer_js_integrity: ''
      viewer_css: assets/asyncapi/default.min.css
      viewer_css_integrity: ''
```

Or set `load_assets: false` and load the files yourself through `extra_javascript` and
`extra_css`. The page-side runner script is still needed in that case; copy it from
`asyncapi_viewer.assets.RUNNER_JS`.

## Zensical

[Zensical](https://zensical.org/) reads `mkdocs.yml` but does not run MkDocs plugins. Enable the
extension instead; relative `src` paths are rewritten per page by Zensical itself:

```yaml
markdown_extensions:
  - asyncapi_viewer
```

Listing both the plugin and the extension lets one `mkdocs.yml` build under MkDocs and Zensical.
A Zensical build of this project's docs runs in CI.

## Plain Python-Markdown

```python
import markdown

html = markdown.markdown(text, extensions=["asyncapi_viewer"])
```

Extension options (pass them as `extension_configs={"asyncapi_viewer": {...}}`):

| Option | Default | Description |
|---|---|---|
| `viewer_js`, `viewer_css` | pinned unpkg URLs | Where to load the viewer from |
| `viewer_js_integrity`, `viewer_css_integrity` | matching SRI hashes | Empty string omits the attribute |
| `load_assets` | `True` | Emit the loader with the first tag on a page |
| `embed_css` | `True` | Emit the small stylesheet that keeps the viewer inside its container |
| `url_resolver` | identity | Callable mapping `src` (and relative asset URLs) to what the browser fetches |
| `warn` | `logging` | Callable receiving warning messages |

## Attributes

The same names work as element attributes and as `key: value` lines in an `asyncapi` fence.
Only `src` is required. Attribute names are case-insensitive. Boolean attributes accept
`true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`; a bare attribute means `true`.

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `src` | path or URL | required | The AsyncAPI document (JSON or YAML) |
| `id` | string | `asyncapi-viewer-N` | HTML id of the container element |
| `sidebar` | boolean | `false` | Show the navigation sidebar (a toggle button inside the viewer when the column is narrow) |
| `info` | boolean | `true` | Show the info section |
| `servers` | boolean | `true` | Show servers |
| `operations` | boolean | `true` | Show operations |
| `messages` | boolean | `true` | Show messages |
| `schemas` | boolean | `true` | Show schemas |
| `errors` | boolean | `true` | Show parser errors |
| `showMessageExamples` | boolean | viewer default | Show examples for standalone messages |
| `messageExamples` | boolean | `true` | Expand message examples |
| `showServers` | `byDefault`, `bySpecTags`, `byServersTags` | `byDefault` | How the sidebar groups servers |
| `showOperations` | `byDefault`, `bySpecTags`, `byOperationsTags` | `byDefault` | How the sidebar groups operations |
| `useChannelAddressAsIdentifier` | boolean | viewer default | AsyncAPI v3: label operations by channel address |
| `publishLabel`, `subscribeLabel` | string | `PUB`, `SUB` | Operation labels for AsyncAPI v2 |
| `sendLabel`, `receiveLabel`, `requestLabel`, `replyLabel` | string | `SEND`, `RECEIVE`, `REQUEST`, `REPLY` | Operation labels for AsyncAPI v3 |
| `parserOptions` | JSON object | viewer default | Passed to the AsyncAPI parser, e.g. `parserOptions='{"applyTraits": false}'` |
| `schemaID` | string | container id | The viewer's `schemaID` option |

These map onto the React component's
[configuration](https://github.com/asyncapi/asyncapi-react/blob/master/docs/configuration/config-modification.md).
The default for `messageExamples` follows earlier releases of this plugin rather than the viewer.

## How it works

Each tag becomes a `<div class="asyncapi-viewer">` carrying the document URL and the viewer
configuration as HTML-escaped data attributes. The first tag on a page also emits the viewer's
stylesheet and script and a short runner script. The runner fetches each document as text, hands it
to `AsyncApiStandalone.render`, and prints a visible error inside the container if fetching or
rendering fails. No content from the Markdown source is interpolated into JavaScript.

Elements inside fenced or indented code blocks and inline code spans are left alone, and an
`asyncapi` fence nested in a longer fence stays code, so you can document the syntax.

Material for MkDocs users with `navigation.instant` enabled are covered: the runner re-scans the
page on Material's `document$` event.

## Migrating from older names

**From `asyncapi-tag` (1.0 and 1.1).** Replace `asyncapi-tag` with `asyncapi-viewer` in your
requirements. Nothing else has to change: the plugin id `asyncapi-tag`, the extension name
`asyncapi_tag` and the `<asyncapi-tag>` element are still accepted, and `asyncapi-tag` 1.2.0 on PyPI
is a shim that only depends on this package. When convenient, switch to `asyncapi-viewer`,
`asyncapi_viewer` and `<asyncapi-viewer>`; the old names will be removed in 3.0. Default container
ids changed from `asyncapi-tag-N` to `asyncapi-viewer-N`; set `id` if you link to them.

**From `mkdocs-asyncapi-tag-plugin` (0.x).** Also remove the `asyncapi_file` option (MkDocs copies
non-Markdown files itself), use page-relative paths in `src`, and check pages that set string
attributes such as `publishLabel`, which earlier versions silently discarded.

## Updating the pinned viewer

```sh
python scripts/update_viewer.py          # latest @asyncapi/react-component
python scripts/update_viewer.py 3.2.1    # specific version
```

The script rewrites the version, URLs and SRI hashes in `src/asyncapi_viewer/assets.py`.

## Development

```sh
python -m venv .venv && source .venv/bin/activate
pip install -e ".[test]"
pytest
```

The JavaScript runner is syntax-checked with `node` when it is installed. Build the docs site with
`pip install -e ".[docs]" && mkdocs build --strict`. See `AGENTS.md` for the repository layout and
release procedure.

## Roadmap

Plans and evaluations of other ecosystems (Docusaurus, Zensical, MkDocs 2.0) are in
[ROADMAP.md](https://github.com/Weesho-Lapara/asyncapi-viewer/blob/main/ROADMAP.md).

## License

MIT
