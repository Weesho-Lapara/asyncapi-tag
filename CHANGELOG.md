# Changelog

## Unreleased

### Added
- Documentation site at https://weesho-lapara.github.io/asyncapi-tag/, built with the plugin itself
  (Material theme with instant navigation) and deployed from CI. A strict build of it runs on every
  pull request, under MkDocs and under Zensical.
- Zensical support documented: enable `markdown_extensions: [asyncapi_tag]`; Zensical resolves
  relative `src` paths per page on its own.
- Weekly `update-viewer` workflow that re-pins `@asyncapi/react-component`, runs the tests and opens
  a pull request. `scripts/update_viewer.py` gained `--check` and now records the bump in this file.
- Weekly `compat` workflow that runs the suite against the MkDocs 2.0 pre-release and the newest
  Python-Markdown and Material, as an early warning.
- `docs` extra (`pip install asyncapi-tag[docs]`).

## asyncapi-tag 1.0.0 (2026-09-25)

First release under the new name. The project was previously published as
`mkdocs-asyncapi-tag-plugin`; that package is now a deprecated shim depending on this one.

### Changed
- Rewritten as a Python-Markdown extension (`asyncapi_tag`) with a thin MkDocs plugin around it.
  The plugin id `asyncapi-tag` is unchanged.
- The viewer (`@asyncapi/react-component`) is pinned to 3.2.1 and loaded with Subresource
  Integrity instead of `@latest` without a hash. New plugin options `viewer_js`, `viewer_css`,
  `viewer_js_integrity`, `viewer_css_integrity` and `load_assets` allow self-hosting.
- The viewer stylesheet is now loaded; earlier versions rendered unstyled output.
- The viewer renders where the tag is placed, and every tag on a page is rendered, not only the first.
- Per-tag data is emitted in HTML data attributes and rendered by a single runner script. Nothing
  from the Markdown source is interpolated into JavaScript.
- Errors while fetching or rendering are shown inside the container instead of only in the console.
- Warnings (missing document, invalid attribute) go through the MkDocs logger, so
  `mkdocs build --strict` catches them.
- Packaging moved to `pyproject.toml` (PEP 621), `src/` layout, Python 3.9+.

### Fixed
- `src` is resolved relative to the page like MkDocs links, or relative to `docs_dir` when it starts
  with `/`. Earlier versions emitted the build machine's absolute filesystem path.
- YAML documents work: the document is passed to the viewer as text and parsed there.
  Supersedes [#1](https://github.com/Weesho-Lapara/asyncapi-tag/pull/1)
  (thanks @mistermelphin) and fixes the JavaScript syntax error in 0.9.0 reported in
  [#2](https://github.com/Weesho-Lapara/asyncapi-tag/issues/2) (thanks @busches).
- String and enum attributes (`publishLabel`, `showServers`, `parserOptions`, ...) are passed
  through instead of being turned into booleans. Added the AsyncAPI v3 labels
  (`sendLabel`, `receiveLabel`, `requestLabel`, `replyLabel`), `showMessageExamples`,
  `useChannelAddressAsIdentifier`, `schemaID` and `id`.
- Self-closing tags, tags without attributes, multi-line tags and tags inside code blocks are
  handled correctly.
- The `tests` package is no longer installed into site-packages, and the unused
  `beautifulsoup4` dependency is gone.

### Deprecated
- Plugin option `asyncapi_file` is ignored with a warning; MkDocs copies non-Markdown files itself.

## mkdocs-asyncapi-tag-plugin 1.0.0 (2026-09-25)

- Deprecated shim: contains no code and depends on `asyncapi-tag>=1.0.0,<2`.

## mkdocs-asyncapi-tag-plugin 0.9.0 (2024-11-26)

- Attempted YAML support via js-yaml. The emitted JavaScript contained a syntax error, so the
  viewer did not render (issue #2).

## mkdocs-asyncapi-tag-plugin 0.8.0 (2024-10-17)

- Last working release under the old name. JSON documents only.
