# Roadmap and evaluations

Living notes on where the project could go next and what has been tried. Conventions and the
release procedure live in [AGENTS.md](AGENTS.md); this file is about direction. Dates are when the
note was written; re-verify anything time-sensitive.

## Status of the original roadmap (2026-09-25)

Near term, done:

- Weekly viewer bump PRs (`update-viewer.yml`).
- Compatibility early warning (`compat.yml`); Zensical promoted to a required CI check.
- Documentation site on GitHub Pages, built with the plugin. It surfaced three real bugs on the
  first day (only the first viewer rendering, overflow into the table of contents with floating
  sidebar controls, header painted over), so keep treating it as the end-to-end test.
- Fenced-block syntax (```` ```asyncapi ````).

Not started, in suggested order:

1. **Bundled viewer option.** Ship the standalone bundle and stylesheet inside the wheel and add an
   `assets: bundled` plugin option, so air-gapped builds and strict Content Security Policy sites
   work with zero configuration. Everything needed exists: the resolver handles relative asset paths
   and the loader omits integrity attributes for local files. Also the right answer for users whose
   content blockers block `unpkg.com`.
2. **Build-time validation.** A lightweight check that the referenced file parses as JSON or YAML and
   has an `asyncapi` version key, reported through the MkDocs logger so strict builds fail early.
   The real AsyncAPI parser is Node only, so full validation would need the Node toolchain.
3. **Config-level defaults.** Let `mkdocs.yml` set default attributes (`sidebar`, labels) so pages
   don't repeat them; per-tag attributes override.
4. **Server-side rendering (opt-in).** Generate static HTML at build time via the AsyncAPI HTML
   template so pages show content without JavaScript and search can index operations. Introduces a
   Node dependency, so keep it optional.
5. **Material polish.** Dark mode by mapping the viewer's CSS variables onto Material's palette, and a
   Playwright test that exercises `navigation.instant` in a real browser.
6. **Other ecosystems.** Docusaurus is evaluated below; Sphinx would follow the same pattern
   (directive plus the shared runner and pinning).

## Docusaurus support (evaluated 2026-09-25, parked)

Decision: not pursued for now. A working prototype exists under [prototypes/docusaurus/](prototypes/docusaurus/).

What was learned:

- **Same syntax works.** A ~60-line remark plugin rewrites ```` ```asyncapi ```` fences and
  `<asyncapi-tag>` elements into an `<AsyncApiTag src options />` JSX node and injects the import,
  so `.md` and `.mdx` both work with one config line and no swizzling.
- **Do not bundle `@asyncapi/react-component` through webpack.** Its parser depends on Node core
  modules (`util`, `buffer`, `crypto`) that webpack 5 no longer polyfills; the Docusaurus build fails
  out of the box. Loading the prebuilt standalone bundle at runtime (same version pin and SRI as the
  Python package) avoids that and keeps one pinning story. A "bundled" mode would import the
  prebuilt standalone file instead of the package entry point.
- **Wrap in `BrowserOnly`.** The viewer must not run during server-side rendering.
- **Paths are simpler than MkDocs.** Docusaurus serves `static/` at the site root and `useBaseUrl`
  handles the base path, so site-root-relative `src` values just work. Page-relative paths would need
  the doc's route, which the remark plugin can read from the vfile if wanted.
- **Containment CSS is identical.** The eight `EMBED_CSS` rules keep the viewer inside the article
  column in the Docusaurus theme too.

What shipping would take (about two hours of implementation plus npm account setup):

- `packages/docusaurus/` npm package (`docusaurus-remark-asyncapi-tag` or similar) with the plugin
  and component as entry points, TypeScript declarations, README.
- Share the viewer pin: have `scripts/update_viewer.py` rewrite the JS constants too, so the weekly
  PR bumps both ecosystems.
- Jest tests mirroring the Python suite (fence, element, nested fence, info-line path, config
  mapping), and a minimal Docusaurus build in CI as the end-to-end check.
- Publish job on tag via npm trusted publishing; the package name and the GitHub publisher link must
  be created on npmjs.com by the maintainer.
- Gaps in the prototype to close: page-relative `src`, `<asyncapi-tag>` inside a paragraph
  (mdxJsxTextElement is handled but untested), build-time warnings for unknown options.

## Ecosystem notes

- **Zensical** (0.0.65) ignores `plugins:` silently but honours `markdown_extensions:` and rewrites
  relative `data-asyncapi-src` values per page itself. That is why `mkdocs.yml` lists both forms.
  Build-time "document not found" warnings are MkDocs-only.
- **MkDocs 2.0** (`2.0.dev6` on PyPI) removes the plugin system according to the Material team. The
  Markdown-extension design is the hedge; `compat.yml` runs the suite against the pre-release weekly.
- **The viewer** (`@asyncapi/react-component`) sizes itself with container queries. Below roughly
  1024px of container width it uses a compact layout: sidebar hidden behind a `position: fixed`
  toggle, `fixed` overlay sidebar, centre panel that does not shrink below its content, panels at
  z-index 10-30. `EMBED_CSS` neutralises all of that; re-check the class names on viewer bumps.
- **Material `navigation.instant`** re-executes content scripts after swapping the page; the runner
  additionally subscribes to `document$` once per window and re-renders on `DOMContentLoaded`,
  because on a full load it executes before later containers and the theme bundle exist.
