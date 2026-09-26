# AGENTS.md

Guidance for coding agents and new contributors working in this repository.

## What this is

`asyncapi-viewer` renders AsyncAPI documents in Markdown via an `<asyncapi-viewer src="...">` element.
It is a Python-Markdown extension plus a thin MkDocs plugin. Browser-side rendering is done by the
pinned `@asyncapi/react-component` standalone bundle.

The repository is also home to the deprecated `asyncapi-tag` PyPI package (the previous name), now a
shim under `legacy/` that only depends on `asyncapi-viewer`. The name before that,
`mkdocs-asyncapi-tag-plugin`, is archived on PyPI and no longer built here.

Direction, future plans and evaluations of other ecosystems (Docusaurus, Zensical, MkDocs 2.0)
are in [ROADMAP.md](ROADMAP.md); keep this file to how the repository works.

## Layout

```
src/asyncapi_viewer/
  __init__.py        version, public exports
  assets.py          pinned viewer version/URLs/SRI hashes, RUNNER_JS, loader_html()
  extension.py       Markdown extension: tag regex, attribute parsing, config building, preprocessor
  mkdocs_plugin.py   MkDocs plugin: config options, registers the extension, resolves src per page
viewer/                              the 2.0 web component (Lit + TypeScript, Vite library build,
                                     Vitest); work in progress on the viewer-2 branch, see ROADMAP.md
  src/model/types.ts                 the normalised model, the contract between normalisers and UI
  src/model/invariants.ts            structural rules every model must satisfy (used by tests)
  test/fixtures/expected/            hand-written expected models for the docs example documents
legacy/asyncapi-tag/                 deprecated shim package (own pyproject, no entry points)
scripts/update_viewer.py             bumps the pinned viewer, rewrites assets.py, adds a CHANGELOG line
prototypes/docusaurus/               unpublished proof of concept, see ROADMAP.md
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
python -m build                          # asyncapi-viewer
python -m build legacy/asyncapi-tag
python scripts/update_viewer.py [version]   # --check exits 1 when a newer viewer exists
pip install -e ".[docs]" && mkdocs build --strict   # docs site; `mkdocs serve` to preview
pip install zensical && zensical build             # same site under Zensical
cd viewer && npm ci && npm run check && npm test && npm run build   # the 2.0 viewer (Node 22)
```

## Conventions and constraints

- Never interpolate Markdown-sourced text into JavaScript. Per-tag data goes into HTML-escaped
  `data-asyncapi-*` attributes; `RUNNER_JS` reads them. Keep `RUNNER_JS` free of `</script>`.
- Never load the viewer from `@latest`. `assets.py` constants are managed by
  `scripts/update_viewer.py`; bump them in a dedicated commit and mention the upstream version in
  `CHANGELOG.md`.
- `url_resolver` and `warn` extension options must have non-`None`, non-bool defaults:
  Python-Markdown coerces `None`-default config values with `parseBoolValue`.
- The preprocessor runs at priority 26, before `fenced_code`/`superfences` (25) stash fences, and
  tracks fences itself: a top-level ```` ```asyncapi ```` fence becomes a viewer, any other fence is
  passed through untouched (so tags inside it stay code), and tags in indented code or inline code
  spans are skipped. Both syntaxes share `_block()` (numbering, loader emission).
- `show.sidebar` defaults to off (the viewer's own default); the other `show.*` flags and
  `expand.messageExamples` default to on. Changing defaults is a breaking change.
- `assets.EMBED_CSS` keeps the viewer inside its container: the component uses container queries
  and, in a docs column, a `position: fixed` sidebar toggle/overlay and a non-shrinking centre
  panel, plus z-index 10-30 panels that beat a sticky header; the container's `z-index: 0` confines
  them. Re-check those class names (`.fixed`, `.burger-menu`, `.panel--center`) on viewer bumps.
- The legacy shim must not declare entry points; `asyncapi-viewer` itself registers both the new
  names and the old ones (plugin `asyncapi-tag`, extension `asyncapi_tag`), and the element
  `<asyncapi-tag>` stays an alias of `<asyncapi-viewer>` until 3.0. MkDocs lets the last
  duplicate entry point win silently, so never register the same id twice.
- Warnings in the MkDocs plugin go through `get_plugin_logger` so `--strict` fails on them.
- Do not commit build output, virtualenvs, `site/`, or agent working files; `.gitignore` covers them.
  Use a `scratch/` directory (ignored) for demo sites.
- `mkdocs.yml` lists both `plugins: [asyncapi-viewer]` and `markdown_extensions: [asyncapi_viewer]` on
  purpose: Zensical ignores `plugins` and honours `markdown_extensions`; the plugin does not
  duplicate an extension the user already listed. Keep both.
- The docs site is the end-to-end test. New behaviour should be visible on `docs/demo.md` when it
  makes sense, and `mkdocs build --strict` must stay clean.
- All 2.0 viewer work lives on the `viewer-2` branch until release; `main` keeps 1.x fixes and is
  merged into the branch when needed. CI runs on pushes to both. `viewer/dist/` and
  `viewer/node_modules/` are never committed; `package-lock.json` is.
- Viewer bumps arrive as PRs from `update-viewer.yml`. PRs opened with `GITHUB_TOKEN` do not trigger
  CI, so that workflow runs the tests itself before opening the PR; re-run CI manually if in doubt.

## Releasing

1. Update `__version__` in `src/asyncapi_viewer/__init__.py` and turn the `## Unreleased` section of
   `CHANGELOG.md` into `## asyncapi-viewer <version> (<date>)`. Commit and push to `main`.
2. Tag and push: `git tag v<version> && git push origin v<version>`.
3. `publish.yml` builds, publishes to PyPI with trusted publishing (both projects have a GitHub
   publisher configured: repo `Weesho-Lapara/asyncapi-viewer`, workflow `publish.yml`, environment
   `pypi`) and then creates the GitHub release with that version's changelog section as notes.
   The shim job only runs for the `v1.2.0` tag.
4. After a release, close any issues it resolves with a note pointing at the release.
   The repository was `mkdocs-asyncapi-tag-plugin`, then `asyncapi-tag`, and is now `asyncapi-viewer`;
   GitHub redirects the old URLs.
