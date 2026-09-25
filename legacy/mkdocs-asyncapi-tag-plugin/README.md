# mkdocs-asyncapi-tag-plugin (deprecated)

This package has been renamed to **[asyncapi-tag](https://pypi.org/project/asyncapi-tag/)**.
The code is now a Python-Markdown extension with a MkDocs plugin around it, so it works
in any tool that uses Python-Markdown, not only MkDocs. The old name no longer fits.

Version 1.0.0 of this package contains no code of its own. It only depends on
`asyncapi-tag`, so upgrading it fixes the broken JavaScript that 0.9.0 emitted
(issue #2) and keeps your existing configuration working:

```yaml
plugins:
  - asyncapi-tag
```

Please switch your dependency to `asyncapi-tag`. No further releases will be made
under this name.

```sh
pip uninstall mkdocs-asyncapi-tag-plugin
pip install asyncapi-tag
```

See the [asyncapi-tag README](https://github.com/Weesho-Lapara/asyncapi-tag#readme)
for the full attribute reference and migration notes.
