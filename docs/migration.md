# Migrating from older names

The project has had three names. Every older way of using it keeps working for one major version.

| Name | Versions | Status |
|---|---|---|
| `mkdocs-asyncapi-tag-plugin` | 0.x, 1.0.0 shim | Archived on PyPI; the 1.0.0 shim installs `asyncapi-tag` |
| `asyncapi-tag` | 1.0, 1.1, 1.2.0 shim | Deprecated; the 1.2.0 shim installs `asyncapi-viewer` |
| `asyncapi-viewer` | 1.2 onwards | Current |

## From `asyncapi-tag` (1.0 and 1.1)

1. Replace `asyncapi-tag` with `asyncapi-viewer` in your requirements. Upgrading `asyncapi-tag` to
   1.2.0 also works, since it is now a shim that depends on `asyncapi-viewer`.
2. Nothing else is required. These old names are still registered and accepted:
   the MkDocs plugin id `asyncapi-tag`, the Markdown extension name `asyncapi_tag`, the
   `<asyncapi-tag>` element, and the import `asyncapi_tag` (with a `DeprecationWarning`).
3. When convenient, switch to `asyncapi-viewer` in `mkdocs.yml`, `asyncapi_viewer` in
   `markdown_extensions` and `<asyncapi-viewer>` in pages. The old names will be removed in 3.0.
4. Default container ids changed from `asyncapi-tag-N` to `asyncapi-viewer-N`. Containers carry both
   the `asyncapi-viewer` and `asyncapi-tag` classes, so custom CSS keeps applying; if you link to a
   default id, set `id` explicitly instead.

## From `mkdocs-asyncapi-tag-plugin` (0.x)

1. Replace it with `asyncapi-viewer`. The plugin id in `mkdocs.yml` (`asyncapi-tag`) still works.
2. Remove the `asyncapi_file` plugin option. MkDocs already copies every non-Markdown file under
   `docs/` into the site; the option now only prints a deprecation warning.
3. Use a path relative to the page, or a `/`-prefixed path relative to `docs/`, in `src`. Earlier
   versions emitted the build machine's filesystem path, so only `/`-prefixed paths ever worked.
4. String attributes such as `publishLabel="PUBLISH"` and `showServers="bySpecTags"` now take
   effect. Earlier versions silently discarded them, so check pages that set them.

### What 1.0.0 fixed over 0.9.0

- 0.9.0 emitted JavaScript with a syntax error, so the viewer never rendered.
- YAML documents did not work despite the README saying so.
- The viewer was loaded from `unpkg.com` at `@latest` with no integrity hash, and its stylesheet was
  never loaded.
- The viewer was appended to the end of the page instead of where the tag was, and only the first tag
  per page was handled.
- Attribute values were interpolated unescaped into a JavaScript string.
