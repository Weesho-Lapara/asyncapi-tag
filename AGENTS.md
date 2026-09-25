# AGENTS.md

Guidance for coding agents and new contributors working in this repository.

## What this is

`asyncapi-tag` renders AsyncAPI documents in Markdown via an `<asyncapi-tag src="...">` element.
It is a Python-Markdown extension plus a thin MkDocs plugin. Browser-side rendering is done by the
pinned `@asyncapi/react-component` standalone bundle.

The repository is also home to the deprecated `mkdocs-asyncapi-tag-plugin` PyPI package, which is
now a shim under `legacy/` that only depends on `asyncapi-tag`.

## Layout

```
src/asyncapi_tag/
  __init__.py        version, public exports
  assets.py          pinned viewer version/URLs/SRI hashes, RUNNER_JS, loader_html()
  extension.py       Markdown extension: tag regex, attribute parsing, config building, preprocessor
  mkdocs_plugin.py   MkDocs plugin: config options, registers the extension, resolves src per page
legacy/mkdocs-asyncapi-tag-plugin/   deprecated shim package (own pyproject, no entry point)
scripts/update_viewer.py             bumps the pinned viewer, rewrites assets.py, adds a CHANGELOG line
tests/                               pytest; test_mkdocs_plugin.py builds real sites in tmp_path
docs/ + mkdocs.yml                   documentation site, built with the plugin (Material theme);
                                     docs/examples/ holds the AsyncAPI 2 and 3 demo documents
.github/workflows/ci.yml             tests on Python 3.9-3.14, strict docs build under MkDocs and
                                     Zensical, builds both distributions
.github/workflows/docs.yml           deploys the docs site to GitHub Pages on push to main
                                     (Pages source must be set to "GitHub Actions" once, in Settings)
.github/workflows/publish.yml        PyPI trusted publishing on GitHub release
.github/workflows/update-viewer.yml  weekly viewer re-pin, tests, opens a PR
.github/workflows/compat.yml         weekly informational run against MkDocs 2.0 pre-release and
                                     newest Markdown/Material (continue-on-error)
```

## Commands

```sh
python -m venv .venv && source .venv/bin/activate
pip install -e ".[test]"
pytest                                   # node on PATH enables the JS syntax test
python -m build                          # asyncapi-tag
python -m build legacy/mkdocs-asyncapi-tag-plugin
python scripts/update_viewer.py [version]   # --check exits 1 when a newer viewer exists
pip install -e ".[docs]" && mkdocs build --strict   # docs site; `mkdocs serve` to preview
pip install zensical && zensical build             # same site under Zensical
```

## Conventions and constraints

- Never interpolate Markdown-sourced text into JavaScript. Per-tag data goes into HTML-escaped
  `data-asyncapi-*` attributes; `RUNNER_JS` reads them. Keep `RUNNER_JS` free of `</script>`.
- Never load the viewer from `@latest`. `assets.py` constants are managed by
  `scripts/update_viewer.py`; bump them in a dedicated commit and mention the upstream version in
  `CHANGELOG.md`.
- `url_resolver` and `warn` extension options must have non-`None`, non-bool defaults:
  Python-Markdown coerces `None`-default config values with `parseBoolValue`.
- The preprocessor runs at priority 22: after `fenced_code` (25) stashes fences, before
  `html_block` (20). Indented code is skipped by checking the line's leading whitespace.
- `show.sidebar` defaults to off (the viewer's own default); the other `show.*` flags and
  `expand.messageExamples` default to on. Changing defaults is a breaking change.
- `assets.EMBED_CSS` keeps the viewer inside its container: the component uses container queries
  and, in a docs column, a `position: fixed` sidebar toggle/overlay and a non-shrinking centre
  panel, plus z-index 10-30 panels that beat a sticky header; the container's `z-index: 0` confines
  them. Re-check those class names (`.fixed`, `.burger-menu`, `.panel--center`) on viewer bumps.
- The legacy shim must not declare a `mkdocs.plugins` entry point; MkDocs lets the last duplicate
  entry point win silently.
- Warnings in the MkDocs plugin go through `get_plugin_logger` so `--strict` fails on them.
- Do not commit build output, virtualenvs, `site/`, or agent working files; `.gitignore` covers them.
  Use a `scratch/` directory (ignored) for demo sites.
- `mkdocs.yml` lists both `plugins: [asyncapi-tag]` and `markdown_extensions: [asyncapi_tag]` on
  purpose: Zensical ignores `plugins` and honours `markdown_extensions`; the plugin does not
  duplicate an extension the user already listed. Keep both.
- The docs site is the end-to-end test. New behaviour should be visible on `docs/demo.md` when it
  makes sense, and `mkdocs build --strict` must stay clean.
- Viewer bumps arrive as PRs from `update-viewer.yml`. PRs opened with `GITHUB_TOKEN` do not trigger
  CI, so that workflow runs the tests itself before opening the PR; re-run CI manually if in doubt.

## Releasing

1. Update `__version__` in `src/asyncapi_tag/__init__.py` and turn the `## Unreleased` section of
   `CHANGELOG.md` into `## asyncapi-tag <version> (<date>)`. Commit and push to `main`.
2. Tag and push: `git tag v<version> && git push origin v<version>`.
3. `publish.yml` builds, publishes to PyPI with trusted publishing (both projects have a GitHub
   publisher configured: repo `Weesho-Lapara/asyncapi-tag`, workflow `publish.yml`, environment
   `pypi`) and then creates the GitHub release with that version's changelog section as notes.
   The shim job only runs for the `v1.0.0` tag.
4. After a release, close any issues it resolves with a note pointing at the release.
   The repository was renamed from `mkdocs-asyncapi-tag-plugin` to `asyncapi-tag`; GitHub
   redirects the old URL.
