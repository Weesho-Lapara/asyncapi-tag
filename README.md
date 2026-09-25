# asyncapi-tag

Render [AsyncAPI](https://www.asyncapi.com/) documents inside Markdown pages with a single element:

```html
<asyncapi-tag src="asyncapi.yaml"></asyncapi-tag>
```

`asyncapi-tag` is a [Python-Markdown](https://python-markdown.github.io/) extension, so it works in
any tool built on Python-Markdown. It ships with a plugin for [MkDocs](https://www.mkdocs.org/)
that resolves document paths the same way MkDocs resolves links. Rendering in the browser is done
by the official [AsyncAPI React component](https://github.com/asyncapi/asyncapi-react), pinned to
an exact version and loaded with Subresource Integrity. JSON and YAML documents both work.

**Documentation and live demo:** https://weesho-lapara.github.io/asyncapi-tag/

> Formerly published as `mkdocs-asyncapi-tag-plugin`. See [Migrating](#migrating-from-mkdocs-asyncapi-tag-plugin).

## MkDocs

```sh
pip install asyncapi-tag
```

```yaml
# mkdocs.yml
plugins:
  - asyncapi-tag
```

Put your AsyncAPI file anywhere under `docs/` and reference it from a page. Paths are relative to
the Markdown file, or relative to `docs/` when they start with `/`. Absolute `http(s)://` URLs are
passed through unchanged.

```markdown
<!-- docs/api/events.md -->
# Events API

<asyncapi-tag src="events.yaml" sidebar="false"></asyncapi-tag>
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
  - asyncapi-tag:
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
  - asyncapi-tag:
      viewer_js: assets/asyncapi/index.js
      viewer_js_integrity: ''
      viewer_css: assets/asyncapi/default.min.css
      viewer_css_integrity: ''
```

Or set `load_assets: false` and load the files yourself through `extra_javascript` and
`extra_css`. The page-side runner script is still needed in that case; copy it from
`asyncapi_tag.assets.RUNNER_JS`.

## Zensical

[Zensical](https://zensical.org/) reads `mkdocs.yml` but does not run MkDocs plugins. Enable the
extension instead; relative `src` paths are rewritten per page by Zensical itself:

```yaml
markdown_extensions:
  - asyncapi_tag
```

Listing both the plugin and the extension lets one `mkdocs.yml` build under MkDocs and Zensical.
A Zensical build of this project's docs runs in CI.

## Plain Python-Markdown

```python
import markdown

html = markdown.markdown(text, extensions=["asyncapi_tag"])
```

Extension options (pass them as `extension_configs={"asyncapi_tag": {...}}`):

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
| `id` | string | `asyncapi-tag-N` | HTML id of the container element |
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

Each tag becomes a `<div class="asyncapi-tag">` carrying the document URL and the viewer
configuration as HTML-escaped data attributes. The first tag on a page also emits the viewer's
stylesheet and script and a short runner script. The runner fetches each document as text, hands it
to `AsyncApiStandalone.render`, and prints a visible error inside the container if fetching or
rendering fails. No content from the Markdown source is interpolated into JavaScript.

Elements inside fenced or indented code blocks and inline code spans are left alone, and an
`asyncapi` fence nested in a longer fence stays code, so you can document the syntax.

Material for MkDocs users with `navigation.instant` enabled are covered: the runner re-scans the
page on Material's `document$` event.

## Migrating from mkdocs-asyncapi-tag-plugin

1. Replace `mkdocs-asyncapi-tag-plugin` with `asyncapi-tag` in your requirements. The plugin id in
   `mkdocs.yml` is unchanged (`asyncapi-tag`).
2. Remove the `asyncapi_file` plugin option. MkDocs already copies every non-Markdown file under
   `docs/` into the site; the option now only prints a deprecation warning.
3. Use a path relative to the page (or `/`-prefixed relative to `docs/`) in `src`. Earlier versions
   emitted the build machine's filesystem path, so only `/`-prefixed paths ever worked; those still work.
4. String attributes such as `publishLabel="PUBLISH"` and `showServers="bySpecTags"` now take
   effect. Earlier versions silently discarded them.

`mkdocs-asyncapi-tag-plugin` 1.0.0 is a deprecated shim that only depends on this package, so
upgrading it also works, but no further releases will be made under the old name.

## Updating the pinned viewer

```sh
python scripts/update_viewer.py          # latest @asyncapi/react-component
python scripts/update_viewer.py 3.2.1    # specific version
```

The script rewrites the version, URLs and SRI hashes in `src/asyncapi_tag/assets.py`.

## Development

```sh
python -m venv .venv && source .venv/bin/activate
pip install -e ".[test]"
pytest
```

The JavaScript runner is syntax-checked with `node` when it is installed. Build the docs site with
`pip install -e ".[docs]" && mkdocs build --strict`. See `AGENTS.md` for the repository layout and
release procedure.

## License

MIT
