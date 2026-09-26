# Roadmap and evaluations

Living notes on direction. Conventions and the release procedure live in [AGENTS.md](AGENTS.md).
Dates are when a note was written; re-verify anything time-sensitive.

## Top priority: our own viewer (2.0)

Decision (2026-09-25): replace the wrapped `@asyncapi/react-component` with a viewer of our own, a
Lit web component, following [specs/viewer-spec.md](specs/viewer-spec.md). The Python side keeps its
architecture (extension first, MkDocs plugin as a thin layer); only the renderer and asset model change.

Why: a bundle around a tenth of today's 3 MB, no third-party CDN, CSP-clean, container-native
layout instead of CSS patches, dark mode, full control of the design. Cost: we maintain spec
coverage ourselves; see "Risks" below.

### Amendments to the spec

These override the imported spec where they differ:

1. **Option naming.** Do not redefine `viewer_css`. Add `viewer_theme` for the theme file and keep
   `viewer_css` as a deprecated alias that warns.
2. **Asset default.** The wheel ships the built viewer, so the default is serve-from-the-site (copied
   into the build like any static file). CDN URLs remain an option, not the default.
3. **Generated files.** `options.schema.json` and the built viewer are never committed. CI and local
   test runs execute the Node build first (`npm --prefix viewer run build`), then the Python tests.
   A `make`/script target wraps this so `pytest` alone tells you what to run if the files are missing.
4. **Escape hatch.** 2.0 keeps the 1.x renderer selectable for one major version
   (`renderer: legacy`), so a user hit by a coverage gap can flip back without downgrading.
5. **Coverage gate.** Phase 1 is not done until the normaliser has been run over the AsyncAPI
   example corpus (asyncapi/spec repository examples plus our fixtures) and the report of what lands
   in `problems[]` has been reviewed.
6. **Names.** Element `<asyncapi-viewer>`, npm package `asyncapi-viewer`, PyPI `asyncapi-viewer`
   (see "Rename" below). The spec's `<asyncapi-tag-viewer>` is superseded.
7. **CSS custom properties** use the prefix `--asyncapi-` (the spec's `--aat-` came from the old
   name). The theme file targets the `asyncapi-viewer` element. Decided 2026-09-26.
8. **Sidebar default** stays `false` in 2.0 (spec decision 2, confirmed 2026-09-26).
9. **Generated examples** (overrides spec decision 3, section 3.3 and section 7): when a message has
   no authored example, the viewer generates one from the schema so readers get a taste of real
   traffic. Values come from, in order: the field's own `examples` or `default`, the first `enum`
   value, `format` (plausible uuid, email, date-time, uri, ...), numeric bounds, then field-name
   heuristics; never bare `"string"` or `0` when a hint exists. The panel label reads
   "Generated from schema" so it is never mistaken for an authored example. Decided 2026-09-26.
10. **Anchors and focus.** The default element id is `asyncapi-viewer-N` (what the Python side
   already emits); anchors are `#<element id>--<section>--<item id>`. Section, operation, message and
   schema headings are focus targets (`tabindex="-1"`): following a sidebar link or loading a URL
   with such a hash scrolls to the heading and moves keyboard focus there. In the drawer, focus
   returns to the menu button only when it closes without a choice. Decided 2026-09-26.
11. **Sidebar as a generic list.** The sidebar renders one list of nav items
   `{ kind: 'section' | 'operation' | 'message' | 'schema', label, anchor, group?, badge?,
   search: string[] }` built once per render. Today it holds sections and operations; messages and
   schemas can be added later without touching search, grouping or the current-item highlight.
   Search (spec 4.9) is a live filter on that list: case-insensitive, the query is split on spaces
   and every term must match one of heading, channel address (with `{params}`), operation id, or
   message names and titles; results keep document order; groups with no matches disappear;
   it composes with the server selector as an intersection; empty state "No operations match";
   a polite live region says "N of M operations shown" (debounced); Escape clears the input, a
   second Escape on an empty input closes the drawer; no `<mark>` highlighting. While a query is
   active the section links (Info, Servers, Messages, Schemas) are hidden; the new option
   `searchKeepSections` (boolean, default `false`, attribute `search-keep-sections`) keeps them
   visible. Decided 2026-09-26.
12. **Host palette is opt-in.** `theme="auto"` follows only the host's light/dark state (Material's
   `data-md-color-scheme`, `html[data-theme]`, the system preference). Colours and fonts come from
   the viewer's own tokens. Matching a Material site's palette is a documented two-line override in
   the theme file (`--asyncapi-primary: var(--md-primary-fg-color)` and the font variables), not the
   default, so every site looks right without tuning. Decided 2026-09-26.
13. **Example panel layout.** The operation block is an intro (badge, heading, channel, summary,
   description, parameters) at full width, then a body with the message on the left and the
   example panel on the right, so the panel starts level with the payload tree. The two-column
   body needs the *main column* (viewer minus sidebar) to be 1100px or wider; below that the
   panel stacks under the message. Decided 2026-09-26 after review.

### Work plan in session-sized chunks

Each chunk is 1 to 3 hours, has its own acceptance check, and ends in a green CI run on the
feature branch `viewer-2` (feature flags or unused code are fine between chunks). Do them in order
unless noted. All 2.0 work stays on `viewer-2` until the release; `main` keeps receiving 1.x fixes
and is merged into the branch when needed. `ci.yml` runs on pushes to `viewer-2`; the docs deploy
stays main-only.

**Phase 0: groundwork**

| # | Chunk | Depends on | Done when |
|---|---|---|---|
| 0.1 | ~~Rename to `asyncapi-viewer` (repo, packages, docs, shim for the old name).~~ Done 2026-09-26 (1.2.0). | | Old configs still work; new name on PyPI |
| 0.2 | ~~`viewer/` skeleton: Vite library mode, Lit, TypeScript, Vitest, ESLint. An empty `<asyncapi-viewer>` that renders its `src` attribute as text. `demo/index.html`. CI job: Node build, then Python tests.~~ Done 2026-09-26, plus the model types (`src/model/types.ts`), the invariants checker and hand-written expected models for both example documents, which are the design reference for 1.4 and 1.5. | 0.1 | `npm run build` yields one ESM and one IIFE file; CI green |

**Phase 1: the viewer**

| # | Chunk | Depends on | Done when |
|---|---|---|---|
| 1.1 | ~~`options.schema.json` and `options.ts`: every option, kebab-case and lowercased forms, boolean rules identical to Python, one `console.warn` per bad value.~~ Done 2026-09-26. One deliberate difference: the DOM reports a bare attribute as `""`, so the viewer treats an empty boolean value as true; align the Python side in 2.1. | 0.2 | Vitest covers every option and the Python boolean table |
| 1.2 | ~~Loader: fetch as text, JSON-then-YAML parse, error model naming URL and reason.~~ Done 2026-09-26. The `yaml` package costs about 30 kB gzipped; revisit if the final bundle needs trimming. | 0.2 | Vitest with good, malformed and missing documents |
| 1.3 | ~~`$ref` resolver: internal, relative file, absolute URL, per-document cache, cycle detection producing a "Circular reference" leaf.~~ Done 2026-09-26. `preload()` fetches external documents once, then `resolve()`/`deref()` are synchronous; `$ref` chains have a cycle guard, and schema-graph cycles are left to the tree builder (1.6), which stops on a repeated resolved id. | 1.2 | Fixtures: external ref, circular ref, six-level nesting |
| 1.4 | ~~Model types and the v3 normaliser: info, servers, channels, operations, messages, reply, tags, external docs.~~ Done 2026-09-26. The normaliser reproduces the hand-written `orders-v3` model exactly; a first schema tree builder (objects, arrays, required, constraints, refName, circular leaves) came with it, composition and raw formats stay in 1.6. | 1.3 | Snapshot of `orders-v3.yaml` plus request/reply and multi-message fixtures |
| 1.5 | ~~v2 normaliser: direction mapping, labels, headings, location hints, parameters with schema, message `oneOf`.~~ Done 2026-09-26. Reproduces the hand-written `accounts-v2` model exactly; v2 security requirements are looked up in `components.securitySchemes`. Anchor slugs collapse separator runs so an item anchor never contains `--`. | 1.4 | Snapshot of `accounts-v2.json` plus parameter and oneOf fixtures |
| 1.6 | ~~Schema tree builder: required from parent arrays, type plus format, unions, `allOf` merge, `oneOf`/`anyOf` variants, constraints, enum/const/default, `RawSchema` for Avro/Protobuf.~~ Done 2026-09-26. Also tuples (`[0]`, `[1]`), `additionalProperties` as a `*` child, `patternProperties` as `/pattern/` children, boolean schemas, and a location id on every root so self-references are caught at the first hop. | 1.4 | Fixtures for each rule; Avro payload renders as raw block in the model |
| 1.7 | ~~Traits (`applyTraits`), bindings (all scopes), security, `problems[]` for skipped or suspicious input.~~ Done 2026-09-26. Merge order follows the official parser: the object's own fields win, then earlier traits over later ones; forbidden trait keys (`action`, `channel`, `messages`, `reply`, `message`, `payload`) are dropped with a problem. New warnings: v3 operation on a channel with no messages, v2 channel with neither publish nor subscribe. | 1.5, 1.6 | Trait and missing-channel fixtures; problems listed |
| 1.8a | ~~Coverage gate, part 1: script that pulls the AsyncAPI example corpus, runs the normaliser, writes a report of problems per document.~~ Done 2026-09-26: `npm run coverage` sparse-clones `examples/` from asyncapi/spec at `master` (all 3.1) and at `v2.6.0`, adds our examples and fixtures, and writes the report with counts that expose silent gaps (operation messages, payload-less and raw messages). | 1.7 | Report checked into `viewer/test/coverage/REPORT.md` |
| 1.8b | ~~Coverage gate, part 2: fix the gaps the report shows (repeat until the residue is acceptable and documented).~~ Done 2026-09-26 for the spec corpus: the one violation (root-level array schemas) was an invariants bug, fixed with a test. Residue: every remaining problem in the report comes from our own fixtures and is intentional (missing files, cycles, forbidden trait keys, bad references). The spec examples are tidy; keep adding real-world documents to the corpus as they turn up in issues, and rerun `npm run coverage` before each release. | 1.8a | Reviewed report; residue explained |
| 1.9 | ~~UI foundation: tokens, theme resolution (`auto`, Material scheme, `html[data-theme]`, media query, MutationObserver), header (logo slot rule, title, pills), Info section.~~ Done 2026-09-26. Public `--asyncapi-*` variables map to private `--_*` tokens with design defaults; the resolved mode is reflected as `resolved-theme` on the host; badge ink and text-safe accents are derived at runtime through a probe element. markdown-it adds about 46 kB gzipped (bundle now 94 kB); consider a lighter renderer in 1.18 if the budget matters. | 1.1, 1.4 | Demo shows header and Info for both docs in light and dark |
| 1.10 | ~~Operation block, part 1: badge, location hint, heading, channel row with parameter links, summary and description via markdown-it (`html: false`).~~ Done 2026-09-26, plus hash navigation (on load and on `hashchange`): an anchor inside the viewer scrolls to its block and focuses the heading. | 1.9 | Both docs render their operations |
| 1.11 | ~~Payload tree: rows, guide lines, path line from level four, expand/collapse with `aria-expanded`, toolbar, default depth, `oneOf` segmented control, constraints line.~~ Done 2026-09-26. Display rule: the `[]` item node is never a row; a primitive item folds into the parent's type (`array of string`), an object item's children become the array's children. Tree state (expansion, selected variant) lives per viewer, keyed by node path, and resets on a new `src`. | 1.6, 1.10 | Six-level and oneOf fixtures render; keyboard operable |
| 1.12 | ~~Example panel: Payload/Headers tabs, copy with live region, line numbers, multi-example select, collapsed mode, correlation id.~~ Done 2026-09-26, with the generated examples of amendment 9 (`util/example.ts`, labelled "Generated from schema") and the two-column operation layout from 1100px with a sticky panel. A failed clipboard write says "Copy failed" and announces it. | 1.10 | Examples from fixtures render; `messageExamples=false` collapses |
| 1.13 | ~~Operation block, part 2: parameters table, multi-message tabs, headers tree, reply block, bindings chips, security list.~~ Done 2026-09-26. Message tabs (arrow keys, `tabpanel`) drive both the tree and the example panel; the chips merge channel, operation and selected-message bindings with their scope prefix; reply message chips link to the Messages section (1.14). | 1.11, 1.12 | Request/reply and bindings fixtures render |
| 1.14 | ~~Remaining sections: Servers (cards, variables), Messages, Schemas (collapsible), Problems; server selector with filtering; Download spec.~~ Done 2026-09-26. Download uses an object URL over the fetched text so cross-origin documents download instead of navigating; Schemas use native `<details>`; filtering shows a status line with the hidden count. | 1.13 | Selector filters operations; download returns original bytes |
| 1.15 | ~~Sidebar and drawer: grouping modes, search, current-item highlight via IntersectionObserver, drawer with focus trap, Escape, `inert`, focus return.~~ Done 2026-09-26 on the generic nav item list of amendment 11 (`render/nav.ts`, tested). `showServers` lists server items under the Servers link only in a grouping mode. The drawer is an absolutely positioned overlay inside the viewer with a sticky panel, so it stays inside the container and still follows the viewport. | 1.14 | Keyboard walkthrough passes; grouping fixtures |
| 1.16 | ~~Container breakpoints and spacing (1100, 700), header reflow, phone tweaks; anchors `#<id>--<section>--<item>`; multiple viewers per page; late insertion.~~ Done 2026-09-26. Measured at 1280, 820 and 380: padding, heading and address sizes, pills, menu button, selector row and column counts all per spec 4.5/4.6, no horizontal overflow. Fixed on the way: the header did not wrap (title crushed at 700-1099), message cards overflowed narrow containers, the server select was uncapped beside the sidebar. Independence verified: per-element theme override, tree state and ids; an element inserted through innerHTML after load renders. | 1.15 | Three widths look right; two viewers on one page independent |
| 1.17 | Accessibility and CSP: axe-core in Playwright, contrast checks, badge text colour rule, CSP test page under `script-src 'self'; style-src 'self'` in Chromium, Firefox, WebKit (write down the result). | 1.16 | No serious/critical axe issues; CSP page renders in all three |
| 1.18 | Playwright screenshot suite (1280/820/380 × light/dark × two docs), bundle size report, final demo page. | 1.17 | Suite green; gzipped IIFE size recorded in `viewer/README.md` |

**Phase 2: Python-Markdown extension**

| # | Chunk | Depends on | Done when |
|---|---|---|---|
| 2.1 | Emit `<asyncapi-viewer ...>` (kebab-case, escaped), validate against the copied schema, deprecations (`schemaID`, `embed_css`, unsupported `parserOptions`), `renderer: legacy` switch keeping the 1.x path. | 1.1 | Existing tests pass with minimal updates; new tests for every option |
| 2.2 | Assets: built files in the wheel, `copy_assets(dest)`, serve-from-site default, `viewer_theme` plus deprecated `viewer_css`, module vs IIFE decision written down, `RUNNER_JS` deprecation shim. | 1.18, 2.1 | Wheel contains viewer; MkDocs and Zensical builds serve it locally |
| 2.3 | `search_fallback`: hidden list of headings/addresses/messages for local files only (PyYAML optional dependency), removed by the viewer on render. | 2.1 | Tests on and off; remote `src` never fetched at build |
| 2.4 | Playwright test: a page produced by plain Python-Markdown renders both example documents. | 2.2 | Test in CI |

**Phase 3: MkDocs plugin, Zensical, docs, release**

| # | Chunk | Depends on | Done when |
|---|---|---|---|
| 3.1 | Plugin: local `src` existence check through the MkDocs logger, option pass-through, drop `document$` reliance; Playwright instant-navigation test on the built docs site. | 2.2 | `--strict` fails on a missing local file; instant nav test green |
| 3.2 | Docs site: demo on the new viewer with a "Customise" example, attributes (`theme`, `themeToggle`, deprecations), configuration and CSP rewrite, new Customising page, migration guide, changelog. | 3.1 | Strict build green under MkDocs and Zensical |
| 3.3 | Release pipeline: one version for npm and PyPI, Node build then wheel, SRI generation for the CDN option, retire `update-viewer.yml`. Publish 2.0.0. | 3.2 | Tag push publishes both; 2.0.0 installable |
| 3.4 | Follow-up: close issues, announce, watch for coverage reports for two weeks before removing anything legacy. | 3.3 | |

Estimate: about 35 to 45 hours of implementation across roughly 30 sessions; Phase 1 is three
quarters of it, and 1.8b is the chunk most likely to grow.

### Risks

- **Spec coverage.** The upstream component leans on the official parser for the long tail of
  real documents. Our normaliser will be right on the examples quickly and then meet unusual specs.
  Mitigations: the coverage gate (amendment 5), the Problems panel so nothing fails silently, and
  the legacy renderer switch (amendment 4).
- **Spec evolution.** CSS and the theme file are insulated: they style the internal model, not spec
  fields. Only the normaliser knows spec field names, so a new AsyncAPI minor version is a normaliser
  change and a release; a future 4.0 is a larger job, as it will be for everyone. Bindings render as
  generic chips, so new binding fields appear without code changes.
- **Maintenance surface.** A Node toolchain, Playwright in three browsers and a two-registry release
  join the repo. Keep chunks small and CI green so the surface stays manageable.

## Rename to asyncapi-viewer (done 2026-09-26, release 1.2.0)

The fenced-block syntax made "tag" a misnomer; the new viewer makes the name wrong twice. Target
names, all checked free on 2026-09-25: PyPI `asyncapi-viewer`, npm `asyncapi-viewer`, GitHub
`Weesho-Lapara/asyncapi-viewer`, import package `asyncapi_viewer`, MkDocs plugin id
`asyncapi-viewer`, Markdown extension `asyncapi_viewer`, authoring element `<asyncapi-viewer>`.

Compatibility kept for one major version: plugin id `asyncapi-tag`, extension name `asyncapi_tag`,
element `<asyncapi-tag>`, and a PyPI shim `asyncapi-tag` depending on `asyncapi-viewer`. The fence
language `asyncapi` does not change. The old `asyncapi-tag` PyPI project can be archived once 1.2.0 is out.

## Later ideas (after 2.0)

- Build-time validation of local documents through the normaliser (Node) or a light JSON/YAML check.
- Config-level default attributes in `mkdocs.yml`.
- Server-side rendering of the model to static HTML for no-JavaScript readers and search indexing.
- Sphinx adapter; Docusaurus adapter (evaluation below).

## Docusaurus support (evaluated 2026-09-25, parked)

Decision: not pursued for now. A working prototype exists under [prototypes/docusaurus/](prototypes/docusaurus/).
Once the new viewer exists as a web component, a Docusaurus adapter shrinks to a remark plugin that
emits the element; the React wrapper in the prototype becomes unnecessary.

What was learned:

- **Same syntax works.** A ~60-line remark plugin rewrites ```` ```asyncapi ```` fences and
  `<asyncapi-tag>` elements into a JSX node and injects the import, so `.md` and `.mdx` both work.
- **Do not bundle `@asyncapi/react-component` through webpack.** Its parser depends on Node core
  modules that webpack 5 no longer polyfills; the build fails out of the box. Loading a prebuilt
  bundle at runtime avoids that. Moot once our own viewer ships without the parser.
- **Wrap in `BrowserOnly`**; the viewer must not run during server-side rendering.
- **Paths are simpler than MkDocs**: `static/` is served at the site root and `useBaseUrl` handles
  the base path.

## Ecosystem notes

- **Zensical** (0.0.65) ignores `plugins:` silently but honours `markdown_extensions:` and rewrites
  relative `data-asyncapi-src` values per page itself. That is why `mkdocs.yml` lists both forms.
  Build-time "document not found" warnings are MkDocs-only.
- **MkDocs 2.0** (`2.0.dev6` on PyPI) removes the plugin system according to the Material team. The
  Markdown-extension design is the hedge; `compat.yml` runs the suite against the pre-release weekly.
- **The current viewer** (`@asyncapi/react-component`) sizes itself with container queries. Below
  roughly 1024px of container width it uses a compact layout with `position: fixed` controls and a
  non-shrinking centre panel; `EMBED_CSS` neutralises that. Goes away with 2.0.
- **Material `navigation.instant`** re-executes content scripts after swapping the page; the 1.x
  runner also subscribes to `document$`. Custom element upgrades make this unnecessary in 2.0.
