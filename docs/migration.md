# Migrating from mkdocs-asyncapi-tag-plugin

The project was published as `mkdocs-asyncapi-tag-plugin` until version 0.9.0. Version 1.0.0 was
released under the new name `asyncapi-tag`, and `mkdocs-asyncapi-tag-plugin` 1.0.0 is a deprecated
shim that only depends on it.

1. Replace `mkdocs-asyncapi-tag-plugin` with `asyncapi-tag` in your requirements. The plugin id in
   `mkdocs.yml` is unchanged (`asyncapi-tag`).
2. Remove the `asyncapi_file` plugin option. MkDocs already copies every non-Markdown file under
   `docs/` into the site; the option now only prints a deprecation warning.
3. Use a path relative to the page, or a `/`-prefixed path relative to `docs/`, in `src`. Earlier
   versions emitted the build machine's filesystem path, so only `/`-prefixed paths ever worked.
   Those still work.
4. String attributes such as `publishLabel="PUBLISH"` and `showServers="bySpecTags"` now take
   effect. Earlier versions silently discarded them, so check pages that set them.

Upgrading the old package name also works (`pip install -U mkdocs-asyncapi-tag-plugin` pulls in
`asyncapi-tag`), but no further releases are made under the old name and the PyPI project is archived.

## What 1.0.0 fixed

- 0.9.0 emitted JavaScript with a syntax error, so the viewer never rendered.
- YAML documents did not work before 1.0.0 despite the README saying so.
- The viewer was loaded from `unpkg.com` at `@latest` with no integrity hash, and its stylesheet was
  never loaded.
- The viewer was appended to the end of the page instead of where the tag was, and only the first tag
  per page was handled.
- Attribute values were interpolated unescaped into a JavaScript string.
