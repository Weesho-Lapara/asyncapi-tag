> **Repository copy of the viewer specification** (imported 2026-09-25). This is the source of
> truth for the new viewer. Amendments agreed after import are listed in
> [ROADMAP.md](../ROADMAP.md#amendments-to-the-spec) and take precedence over the text below.
> Naming note: the project is being renamed to `asyncapi-viewer`; read `asyncapi-tag` below as the
> current name and `<asyncapi-tag-viewer>` as the pre-rename element name (see the roadmap).

# asyncapi-tag: new viewer, instructions for Claude Code

These instructions replace the viewer inside `asyncapi-tag`. Today the package wraps the official
`@asyncapi/react-component` (pinned from unpkg, rendered by a small runner script). The goal is a
viewer of our own, built as a web component, with a new visual design, while every existing way of
using the package keeps working.

Work through the phases in order. Finish each phase's acceptance checks before starting the next.
If something here conflicts with what you find in the repository, stop and ask rather than guessing.

Human reference for the design (you may not be able to open it): the "AsyncAPI Viewer" design
canvas in Claude. Everything you need from it is written down in the Design spec section below.

---

## 0. Ground rules

### Supported targets (must keep working)

1. **Plain Python-Markdown**: `markdown.markdown(text, extensions=["asyncapi_tag"])`.
2. **MkDocs**: the `asyncapi-tag` plugin, including Material for MkDocs with `navigation.instant`.
3. **Zensical**: via `markdown_extensions: [asyncapi_tag]` (no plugin hooks there).

Sphinx and Docusaurus are **not** in scope. Do not build adapters for them. Do keep the viewer free
of any MkDocs or Python assumptions so an adapter could be added later (see 0.3).

### Read before you change anything

Before writing code, read the repository and write a short summary (as a comment in your first
reply, not a file) of:

- how the extension finds tags and ```` ```asyncapi ```` fences, and how it skips code blocks,
  inline code and nested fences;
- how attributes are parsed, validated and warned about (`warn` callable, MkDocs logger, `--strict`);
- `url_resolver` and how `src` and asset URLs are resolved per page;
- `asyncapi_tag.assets` (`EMBED_CSS`, `RUNNER_JS`) and the `viewer_js` / `viewer_css` /
  `*_integrity` / `load_assets` / `embed_css` options;
- the existing tests, the docs site under `docs/`, and CI (including the Zensical build and the
  weekly re-pin workflow).

The Python side is already structured correctly: a Python-Markdown extension first, with the MkDocs
plugin as a thin layer on top. **Keep that architecture.** This project swaps the renderer. It does
not rewrite the tag parsing, the fence parsing or the validation.

### Portability rule

The viewer lives in its own folder with its own build and knows nothing about MkDocs, Zensical or
Python. Its only interfaces are:

1. the custom element and its attributes,
2. the options schema (`options.schema.json`),
3. the CSS custom properties in the theme file.

A plain `.html` file with one `<script>` tag must be enough to run it. That demo page is the
portability test.

### Style rules for anything user-facing you write (docs, messages, comments in examples)

- No em-dashes.
- Plain, direct sentences. No filler or marketing phrasing.

---

## 1. Decisions already made

| Topic | Decision |
|---|---|
| Component | Web component built with **Lit + TypeScript** |
| Element name | `<asyncapi-tag-viewer>` (prefixed to avoid clashing with other AsyncAPI tools). Guard with `customElements.get()` before `define()` so loading the script twice is harmless. |
| Styling | Plain CSS in **Shadow DOM**, driven by **CSS custom properties** prefixed `--aat-` |
| Responsive | **Container queries**, not media queries. The viewer usually sits in a docs column, so the column width decides the layout, not the screen. |
| Build | **Vite library mode**: one ES module and one self-contained IIFE file |
| Spec parsing | `yaml` package + our own `$ref` resolver + our own v2/v3 normaliser. **Do not** ship `@asyncapi/parser` to the browser. |
| Markdown in descriptions | `markdown-it` with `html: false`, `linkify: false`. Raw HTML in a spec is shown as text, never rendered. |
| Tests | Vitest (normaliser, options, resolver) and Playwright (screenshots, accessibility, behaviour) |
| Fonts | The viewer never loads web fonts itself (CSP, privacy, offline builds). It uses font stacks from CSS variables with sensible system fallbacks. The theme file shows how to opt into the design fonts. |

### Decisions to confirm with Weesho before Phase 2 (ask, then continue)

1. npm package name for the viewer. Proposed: `asyncapi-tag-viewer`.
2. Whether `sidebar` should keep defaulting to `false` (current contract) or change to `true` in
   this major release. Until answered, keep `false`.
3. Examples when a message has none: the old viewer generated one from the schema. Proposed: do
   not generate; show "No example in this document". Until answered, do not generate.

---

## 2. Repository layout

Add, do not reorganise:

```
viewer/                       new: the web component (Node project)
  package.json
  vite.config.ts
  src/
    element.ts                <asyncapi-tag-viewer> definition
    options.ts                reads and validates attributes against the schema
    options.schema.json       single source of truth for every option
    load/                     fetch, YAML/JSON parse, $ref resolution
    model/                    normalised model types + v2 and v3 normalisers
    render/                   Lit templates per section
    styles/                   component CSS (tokens, layout, sections)
    util/                     colour maths, ids, clipboard
  theme/asyncapi-theme.css    the easy customisation file (see 4.2)
  demo/index.html             plain HTML demo, no build tooling
  test/                       Vitest + Playwright, fixtures under test/fixtures/
src/asyncapi_tag/             existing Python package (keep structure)
  static/                     new: built viewer files copied here at package build time
  options.schema.json         copied from viewer/ at build time, never edited by hand
```

The Python wheel must contain the built viewer and the schema. Installing `asyncapi-tag` must never
require Node. CI builds `viewer/` first, then the wheel.

---

## 3. Phase 1: the viewer

### 3.1 Options schema

Create `viewer/src/options.schema.json` describing every option: name, type, allowed values,
default, which spec versions it applies to, and a status (`active`, `deprecated-noop`).
Start from the current contract below. Names are case-insensitive everywhere.

| Option | Values | Default | New behaviour |
|---|---|---|---|
| `src` | path or URL | required | The AsyncAPI document (JSON or YAML). |
| `id` | string | `asyncapi-tag-N` | Element id. Also prefixes all internal anchors. |
| `sidebar` | boolean | `false` | Show the navigation column. When the container is narrow it becomes a drawer behind a menu button. |
| `info` | boolean | `true` | Show the Info section. |
| `servers` | boolean | `true` | Show the Servers section and the server selector. |
| `operations` | boolean | `true` | Show operations. |
| `messages` | boolean | `true` | Show the Messages section (component messages). |
| `schemas` | boolean | `true` | Show the Schemas section (component schemas). |
| `errors` | boolean | `true` | Show the load and validation problems panel. |
| `showMessageExamples` | boolean | `false` | Show examples in the Messages section. |
| `messageExamples` | boolean | `true` | Example panels start expanded. `false` starts them collapsed. |
| `showServers` | `byDefault`, `bySpecTags`, `byServersTags` | `byDefault` | Sidebar grouping for servers. |
| `showOperations` | `byDefault`, `bySpecTags`, `byOperationsTags` | `byDefault` | Sidebar grouping for operations. |
| `useChannelAddressAsIdentifier` | boolean | `false` | AsyncAPI 3: label operations by channel address instead of title. |
| `publishLabel`, `subscribeLabel` | string | `PUB`, `SUB` | Badge text for AsyncAPI 2 operations. |
| `sendLabel`, `receiveLabel`, `requestLabel`, `replyLabel` | string | `SEND`, `RECEIVE`, `REQUEST`, `REPLY` | Badge text for AsyncAPI 3 operations. |
| `parserOptions` | JSON object | `{}` | Only `applyTraits` (default `true`) is honoured. Other keys produce a warning and are ignored. |
| `schemaID` | string | none | `deprecated-noop`: accepted, warns once, does nothing. |
| `theme` | `auto`, `light`, `dark` | `auto` | **New.** `auto` follows the host page (see 4.4). |
| `themeToggle` | boolean | `false` | **New.** Show a light/dark toggle in the viewer header. |

Grouping semantics:

- `byDefault`: flat list in document order.
- `bySpecTags`: group by the tags declared at document level (v3 `info.tags`, v2 root `tags`),
  in declared order. Items with none of those tags go under "Other".
- `byOperationsTags` / `byServersTags`: group by the tags on each item itself, first tag wins,
  untagged items under "Other".

Boolean parsing must match the current Python behaviour: `true/false`, `1/0`, `yes/no`, `on/off`,
bare attribute means `true`.

The element reads attributes in **kebab-case** (`send-label`) and also accepts the lowercased
camelCase form browsers produce from hand-written tags (`sendlabel`). Unknown attributes and invalid
values log one `console.warn` each and are skipped, mirroring the Python validation.

### 3.2 Loading

- Fetch `src` as text. Parse as JSON if it parses, otherwise YAML.
- Resolve `$ref`s: internal (`#/...`), relative files and absolute URLs, relative to the document
  URL. Cache each external document once. Detect cycles: a circular schema becomes a leaf that
  reads "Circular reference to `<name>`" and can be followed by anchor link, never infinite recursion.
- Apply traits (v2 and v3 operation and message traits) unless `parserOptions.applyTraits` is `false`.
- Never evaluate anything from the document. Never insert document text as HTML except through
  `markdown-it` with HTML disabled.
- Failures (network, parse, unsupported version) render an error panel inside the element that names
  the URL and the reason. The element never renders as an empty box.

### 3.3 Normalised model

One model for both versions. The UI must never branch on spec version except where noted in 3.4.
Minimum shape (adjust names freely, keep the meaning):

```ts
Document { specVersion: '2.x' | '3.x'; title; version; description?; contact?; license?;
  termsOfService?; externalDocs?; tags[]; defaultContentType?; servers[]; operations[];
  componentMessages[]; componentSchemas[]; problems[] }

Server { id; title?; protocol; protocolVersion?; hostDisplay; description?;
  variables[]; security[]; tags[]; bindings[] }        // hostDisplay: v3 host+pathname, v2 url

Operation { id; heading; action: 'send' | 'receive'; kind: 'send'|'receive'|'request'|'reply';
  badgeLabel; locationHint; channel: Channel; summary?; description?; tags[];
  messages[]; reply?: Reply; security[]; bindings[] }

Channel { id; address: string | null; parameters[]; servers[]; bindings[] }
Parameter { name; description?; enum?; default?; examples?; location?; schemaType? }  // schemaType v2 only
Message { id; name?; title?; summary?; description?; contentType; schemaFormat;
  payload?: SchemaNode | RawSchema; headers?: SchemaNode | RawSchema;
  correlationId?: { location; description? }; examples[]; bindings[] }
SchemaNode { name; path; types[]; format?; required: boolean; description?; enum?; const?;
  default?; constraints; children[]; composition?: { kind: 'allOf'|'oneOf'|'anyOf'; variants[] };
  circularRef?: string }
RawSchema { schemaFormat; source: string }             // Avro, Protobuf etc.
Binding { scope: 'server'|'channel'|'operation'|'message'; protocol; key; value; bindingVersion? }
```

Rules the normaliser owns:

- **Direction.** v3: `action` as written. v2: `publish` means the application **receives**, and
  `subscribe` means it **sends**.
- **Kind and label.** v3: `send` with `reply` is `request` (`requestLabel`), `receive` with `reply` is
  `reply` (`replyLabel`), otherwise `sendLabel` / `receiveLabel`. v2: `publishLabel` /
  `subscribeLabel` by the raw keyword.
- **Heading.** v3: `title`, else operation id. With `useChannelAddressAsIdentifier`, the channel
  address. v2 (no titles): `operationId`, else `<publish|subscribe> <channel key>`.
- **Location hint** (small monospace line above the heading): v3 operation id; v2
  `channels › <channel key> › <publish|subscribe>`.
- **Required.** JSON Schema keeps `required` as an array on the parent object. Mark each child from its
  parent's array; array items use the `items` schema's own array.
- **Types.** Show `type` plus `format` as `string · uuid`. Unions like `["string","null"]` show as
  `string | null`.
- **allOf** merges into one node list. **oneOf / anyOf** keep variants (see 4.7).
- **Non-JSON-Schema formats** (Avro, Protobuf, RAML, anything not the AsyncAPI or JSON Schema format)
  become `RawSchema`: shown as a labelled code block, never forced into the tree.
- **Examples** come only from `message.examples` (v2.2+ and v3). No generation (see decision 3).
- **Problems.** Anything skipped or suspicious (unknown version, unresolved `$ref`, operation with no
  channel) goes into `problems[]` and shows in the errors panel when `errors` is `true`.

Fixtures: at minimum the two documents in `docs/examples/` (`orders-v3.yaml`, `accounts-v2.json`),
plus small purpose-built fixtures for: six-level nesting, circular refs, external `$ref`, oneOf,
allOf, request/reply, multiple messages per operation, Avro payload, traits, missing channel,
v2 parameters with schema. Snapshot the normalised model for each in Vitest.

### 3.4 Where the UI may branch on version

Only these: parameter rows show `schema: <type>` for v2; server rows show `url` (v2) versus
`host` + `pathname` (v3); the header badge reads `AsyncAPI <version>`. Everything else is model-driven.

### 3.5 Acceptance for Phase 1

- `viewer/demo/index.html` renders both example documents side by side from one script tag and the
  theme file, opened from a static file server with no build step.
- Vitest: all fixtures normalise; options parsing matches the Python boolean rules.
- Playwright: screenshots at container widths 1280, 820 and 380, light and dark, for both documents.
  axe-core finds no serious or critical violations.
- A page with `Content-Security-Policy: script-src 'self'; style-src 'self'` still renders the viewer
  fully (no inline scripts, no inline `style` attributes, no `eval`). Check that Lit's constructed
  stylesheets behave under that policy in Chromium, Firefox and WebKit, and write down the result.
- The IIFE build is one file. Report its gzipped size in the PR description.

---

## 4. Design spec

### 4.1 Layout model: document mode

The viewer renders the whole document as one scrolling page, in this order, each section switchable
by its option: Info, Servers, Operations, Messages, Schemas, then Problems if any.

Each **operation** is a block with two columns on wide containers: content on the left, a dark
example panel on the right. On narrow containers the example panel stacks under the content.

The sidebar (when `sidebar` is on) is navigation for this page: anchor links, with the item for the
block currently in view highlighted (IntersectionObserver, no scroll listeners).

### 4.2 Theme file (the easy customisation)

`viewer/theme/asyncapi-theme.css`, shipped as is and documented as the one file most people need:

```css
/* asyncapi-theme.css: copy this file, change the values, load it after the viewer script. */
asyncapi-tag-viewer {
  --aat-primary: #2944C9;                   /* send operations, links, highlights */
  --aat-secondary: #B84E1A;                 /* receive operations, required labels */
  --aat-logo: url("/assets/logo.svg");      /* optional; use a site-absolute path */
  --aat-logo-dark: url("/assets/logo-dark.svg"); /* optional */
}
```

Everything else is derived. Advanced variables (documented separately, not in this file):
`--aat-font-heading`, `--aat-font-body`, `--aat-font-mono`, `--aat-radius`, `--aat-example-width`,
and the neutral tokens in 4.3.

Rules:

- If no logo is set, the logo slot is **not rendered**. Never show a placeholder.
- The logo is decorative (`aria-hidden`); the API title next to it is the accessible name.
- Derived tints use `color-mix()`: selected sidebar item `primary 10%` (dark `20%`), version pill the same.
- Badge text colour is picked at runtime from the resolved accent: `#14161B` when the accent's
  relative lightness is above 0.6, otherwise `#FFFFFF`. Recompute when the theme changes.
- Accent used as text on the page background must reach 4.5:1. If it does not, use a darkened
  (light theme) or lightened (dark theme) variant for text only.

### 4.3 Tokens

Light theme:

| Token | Value | Use |
|---|---|---|
| `--aat-bg` | `#F6F5F1` | page background |
| `--aat-surface` | `#FFFFFF` | cards, header |
| `--aat-sidebar` | `#EFEDE7` | sidebar |
| `--aat-head` | `#F8F7F3` | table/tree toolbars |
| `--aat-ink` | `#17191F` | main text |
| `--aat-ink-2` | `#3A3E48` | secondary text, descriptions |
| `--aat-muted` | `#5E626D` | labels, meta |
| `--aat-line` | `#E3E0D8` | borders |
| `--aat-line-2` | `#C9C5BA` | tree guide lines |

Dark theme: bg `#0F1115`, surface `#161920`, sidebar `#12151A`, head `#1B1F27`, ink `#ECEDEF`,
ink-2 `#C4C8D0`, muted `#959BA7`, line `#262A33`, line-2 `#3A404C`.

Example panel (both themes): background `#12141A`, text `#DCDFE6`, muted `#8C92A0`, line numbers
`#4A505C`, dividers `#262A33`, heading `#F4F5F7`. JSON keys use the primary accent mixed 50% with
white when the accent is dark; strings use the secondary mixed 45% with white; numbers and booleans
`#B7C4E8`; punctuation muted.

Radius: `--aat-radius` default `10px`; small elements use `radius - 3px`.

Fonts (defaults are system stacks; design fonts are opt-in):

- heading: `var(--aat-font-heading, ui-sans-serif, system-ui, sans-serif)`; design value Bricolage Grotesque
- body: `var(--aat-font-body, ui-sans-serif, system-ui, sans-serif)`; design value IBM Plex Sans
- mono: `var(--aat-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)`; design value JetBrains Mono

Type scale: body 14px; summary 16px / 1.6; section h2 20px; operation h1 42px (tablet 36, phone 28);
channel address mono 19px (tablet 17, phone 15); badges mono 12px weight 500, letter-spacing 0.05em;
sidebar badges 10px; labels 11px uppercase, letter-spacing 0.08em.

### 4.4 Theme mode

`theme="auto"` resolves in this order: Material for MkDocs `body[data-md-color-scheme="slate"]`,
then `html[data-theme="dark"]`, then `prefers-color-scheme`. Watch these with a MutationObserver
and a media query listener so the viewer follows the site's own toggle live. `themeToggle` adds an
icon button (moon/sun, `aria-label="Toggle dark theme"`) that overrides the host for this element only.

### 4.5 Container breakpoints

| Container width | Layout |
|---|---|
| 1100px and up | Sidebar column (292px) if enabled, content, example panel (`--aat-example-width`, default 452px, clamp 360 to 560px) |
| 700 to 1099px | No sidebar column. Menu button opens the sidebar as a 320px drawer. Example panel stacks under each operation's content. |
| under 700px | As above, drawer is full width minus 56px, spacing tightens, version pills leave the header. |

Content padding: 36/44/48px (desktop), 28/32/40px (tablet), 20/16/32px (phone).

### 4.6 Header

Left to right: menu button (narrow + sidebar only, 44px square, three lines with a shorter third),
logo (if set, 40px, 34px on phone), API title (heading font, 18px, 16px on phone), then pills:
`v<info.version>` (primary tint) and `AsyncAPI <version>` (outlined). Right side: server selector
(desktop only in the header), Download spec (icon + label on desktop, icon-only otherwise), theme
toggle (if enabled).

On narrow containers the server selector moves to a full-width row directly under the header.

Server selector: shown only when there are two or more servers and `servers` is on. Options read
`<server id> · <protocol> · <hostDisplay>`, plus "All servers" first. Choosing a server filters the
operation list and sidebar to operations whose channel is available on it (v3 `channel.servers`,
v2 `channel.servers`; a channel with none is available on all servers).

Download spec: downloads the original `src` document, unchanged.

No keyboard shortcuts at document level. Material for MkDocs already uses `/` and `s` for search.

### 4.7 Operation block

Top to bottom:

1. Badge (`badgeLabel`, filled with primary for send/request, secondary for receive/reply) and the
   location hint in muted mono. Wraps on narrow containers.
2. Heading (h2 inside the viewer so the host page keeps its own h1; styled at the h1 size above).
3. Channel row: "CHANNEL" label, then the address in mono. Parameters inside `{}` render in the
   primary text colour with a dotted underline and link to the Parameters table. Long addresses wrap
   (`word-break: break-all`). A `null` address shows "Address not specified".
4. Summary, then description (markdown).
5. **Parameters** (if any): name in primary mono; description; `enum: a · b · c · default: x`;
   v2 adds `schema: <type>` under the name. Two columns (160px + rest), one column on phone.
6. **Message**: if the operation has several messages, a tab row of message names first. Then the
   message name, `contentType · schemaFormat` on the right, and the payload tree (4.8). A Headers
   tree follows the same pattern if the message defines headers.
7. **Reply** (request/reply operations only): reply channel address or `address.location`, and the
   reply messages as a compact list linking to their definitions.
8. **Bindings**: chips reading `<scope>.<key> <value>`, e.g. `channel.partitions 12`,
   `operation.groupId orders-api`, `message.key string`, `bindingVersion 0.5.0`. Nested binding
   values render as compact JSON in the chip or a small code block if long.
9. **Security** (if present): scheme names with type, linking to the Servers section.

No flow diagram, no producer/consumer boxes. The spec does not describe the other side of a channel,
so the viewer must not invent it.

Example panel for the operation: label "EXAMPLE", message name, tabs **Payload** / **Headers**
(Headers only if the example has headers), a Copy button (clipboard API, "Copied" announced via an
`aria-live="polite"` region), line-numbered JSON, and at the bottom the correlation ID
`location` if the message has one. Several examples: a select above the code, labelled by example
`name` or "Example N". With `messageExamples="false"` the panel starts collapsed to a slim
"Show example" button and the content takes the full width.

### 4.8 Payload tree

Stacked rows, not a table:

- Row line 1: expand button (only for nodes with children), field name (mono 13px, weight 600 at the
  top level, 500 below), type (mono 12px muted), a "N hidden" pill when collapsed, then
  `required` (secondary text colour, weight 600) or `optional` (muted) pushed to the right.
  Line 1 wraps on narrow containers.
- Row line 2: description, indented to align after the expand button (36px).
- From the fourth level down, a path line above the description: `items[] › customisation › engraving`
  (mono 11.5px, muted, single line, ellipsis).
- Depth shown by vertical guide lines on the left, one per level: 22px for the first three levels,
  12px after that (phone: 14px then 8px), 1px line in `--aat-line-2`.
- Enum, const, default and constraints (min/max, length, pattern) as a small muted mono line under the
  description when present.
- oneOf/anyOf: a segmented control above the variants ("Variant 1", or the variant's `title`), showing
  one variant's children at a time.
- Toolbar above the tree: "<N> fields · <L> levels", Expand all, Collapse all.
- Default: levels 1 to 3 expanded, deeper levels collapsed.
- Expand buttons are real `<button>`s with `aria-expanded` and `aria-label="Expand <name>"` /
  `"Collapse <name>"`.

### 4.9 Sidebar

Search input at the top (filters items by heading, channel address and message name; label
visually hidden, placeholder "Search operations, channels"). Then Info and Servers links, then
operations grouped per `showOperations`, then a Components group with Messages and Schemas links and
counts. Each operation item: small badge, heading, and the channel address in muted mono under it.
Minimum 44px tall. Current item: primary tint background and weight 600. No left-border accent bars.

Drawer (narrow containers): opens from the menu button, dims the rest of the viewer, traps focus,
closes on Escape (listener on the drawer only), on the close button, on the dimmed area, and after
choosing an item. Focus returns to the menu button. The rest of the viewer is `inert` while open.

### 4.10 Other sections

- **Info**: title, version, description (markdown), contact, license, terms of service, external docs,
  document-level tags as chips, default content type.
- **Servers**: one card per server: id, title, protocol and version, `hostDisplay`, description,
  variables table (name, enum, default, description), security scheme names, bindings chips.
- **Messages** (components): name/title, summary, payload and headers trees, examples when
  `showMessageExamples` is on.
- **Schemas** (components): one collapsible entry per schema with its tree.
- **Problems**: a bordered list with the problem and where it was found.

### 4.11 Accessibility and behaviour

- Real `<button>`, `<a href>`, `<select>` + `<label>`, `<input>` + `<label>` everywhere.
- Touch targets 44px minimum, except the in-tree expand buttons (26px, desktop-focused, still keyboard reachable).
- Text contrast 4.5:1, large text 3:1, in both themes.
- Anchors: `#<element id>--<section>--<item id>`, so several viewers on one page never collide.
  Loading a URL with such a hash scrolls to it after render.
- Several viewers on one page must work independently. No globals beyond the element definition.
- Elements added to the page later (Material's instant navigation) must render with no extra code.
  Custom element upgrades do this; verify it.

---

## 5. Phase 2: Python-Markdown extension

Keep the existing parsing, validation and warning code. Change what gets emitted and how assets load.

### 5.1 Output

Each tag or fence becomes:

```html
<asyncapi-tag-viewer id="asyncapi-tag-1" src="..." send-label="EMIT" sidebar></asyncapi-tag-viewer>
```

- Attribute names converted to kebab-case, values HTML-escaped. Nothing from Markdown ever goes into
  JavaScript (keep the current security property).
- Validation uses the copied `options.schema.json`, so Python and the viewer agree on names, values
  and defaults. Deprecated options (`schemaID`, unsupported `parserOptions` keys, `embed_css`) warn
  through `warn` and are dropped.
- Build-time search fallback: inside the element, emit a hidden plain list of operation headings,
  channel addresses and message names **only if** `src` is a local file the build can read. Do not
  fetch remote documents at build time (keep the current "the build never fetches documents" rule).
  The viewer removes this content when it renders. Put the fallback behind an extension option
  `search_fallback` (default `True`).

### 5.2 Assets

The old runner script goes away: the element renders itself.

- `viewer_js`: default is the pinned CDN URL of the published npm package (jsDelivr or unpkg), with
  `viewer_js_integrity` set to its SRI hash, generated at release time. Same model as today.
- `viewer_css`: now means the **theme** file. Default: the pinned CDN URL of `asyncapi-theme.css`
  with its SRI hash. Users who want their own colours point it at their copy.
- `load_assets` (default `True`): emit the script and theme `<link>` once per page with the first tag.
  Emit the script as `<script type="module" src="..." integrity="..." crossorigin="anonymous">`, or the
  IIFE build if module scripts cause trouble with any target; decide with a test, and explain why.
- `embed_css`: deprecated no-op with a warning. Shadow DOM and container queries replaced it.
- Self-hosting: `asyncapi_tag.assets` exposes the paths of the bundled files inside the wheel and a
  `copy_assets(dest_dir)` helper that copies them and returns the SRI hashes. Keep
  `asyncapi_tag.assets.RUNNER_JS` importable for one major version as an empty string with a
  `DeprecationWarning`, so imports in user code do not crash.
- CSP: with self-hosted assets, pages need only `script-src 'self'`, `style-src 'self'` and
  `connect-src` for wherever the documents live. No inline script, no `unsafe-inline`.

### 5.3 Acceptance for Phase 2

- Existing extension tests pass, updated only where the emitted HTML necessarily changed.
- New tests render Markdown to HTML with plain Python-Markdown for: both syntaxes, fence path after
  the language, nested-fence and code-span skipping, every option, invalid values, deprecated options,
  `url_resolver`, `search_fallback` on and off.
- A test page produced by plain Python-Markdown, opened in Playwright, renders both example documents.

---

## 6. Phase 3: MkDocs plugin, Zensical, docs site

- The plugin stays a thin layer: per-page path resolution, build-time check that local `src` files
  exist (warning through the MkDocs logger so `--strict` fails), and option pass-through.
- Material `navigation.instant`: remove the `document$` subscription and prove with a Playwright test
  that navigating between two pages with viewers renders both.
- Zensical: the CI build keeps running. Missing documents are still reported in place by the viewer.
- Docs site updates:
  - Demo page: rebuild on the new viewer, include the error example, and add a "Customise" example
    that loads a modified theme file.
  - Attributes: add `theme` and `themeToggle`, mark `schemaID` and `embed_css` deprecated, describe
    `parserOptions` limits, note the v2 direction mapping and REQUEST/REPLY labels.
  - Configuration: new asset model, `copy_assets`, CSP section rewritten, remove the runner notes.
  - New "Customising" page built around `asyncapi-theme.css`, with the advanced variables listed.
  - Migration: from the React-based viewer to the new one, including visual changes and deprecations.
  - Changelog.
- Replace the weekly re-pin workflow with a release workflow: build `viewer/`, publish to npm, compute
  SRI hashes, write the pinned URLs and hashes into the Python package, build and publish the wheel.
  One version number for both.
- This is a **major** version bump.

### Acceptance for Phase 3

- `mkdocs build --strict` passes on the docs site and fails on a page with a missing local `src`.
- Zensical build passes in CI.
- Playwright on the built site: demo page screenshots at the three widths in both themes; instant
  navigation test; error example shows the in-place message naming the URL.

---

## 7. Out of scope

- Sphinx and Docusaurus adapters, remark plugins, React wrappers.
- Generating examples from schemas (unless decision 3 changes).
- Any diagram of producers and consumers.
- Loading web fonts from inside the component.
- A build-time Node step for users.
