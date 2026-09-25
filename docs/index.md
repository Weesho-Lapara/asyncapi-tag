# asyncapi-tag

Render [AsyncAPI](https://www.asyncapi.com/) documents inside your Markdown pages with one element:

```html
<asyncapi-tag src="asyncapi.yaml"></asyncapi-tag>
```

`asyncapi-tag` is a [Python-Markdown](https://python-markdown.github.io/) extension, so it works in
any tool built on Python-Markdown: [MkDocs](https://www.mkdocs.org/) (with the bundled plugin),
[Zensical](https://zensical.org/), or plain `markdown.markdown()`. Rendering happens in the
browser through the official [AsyncAPI React component](https://github.com/asyncapi/asyncapi-react),
pinned to an exact version and loaded with Subresource Integrity. JSON and YAML both work.

This site is built with the plugin. See the [live demo](demo.md).

## Install

```sh
pip install asyncapi-tag
```

## MkDocs quick start

```yaml title="mkdocs.yml"
plugins:
  - asyncapi-tag
```

Put your AsyncAPI file anywhere under `docs/` and reference it from a page. Paths are relative to the
Markdown file, or relative to `docs/` when they start with `/`. Absolute `http(s)://` URLs pass
through unchanged.

```markdown title="docs/api/events.md"
# Events API

<asyncapi-tag src="events.yaml" sidebar="false"></asyncapi-tag>
```

A missing document or an invalid attribute is a MkDocs warning, so `mkdocs build --strict` fails
instead of shipping a blank viewer.

## What you get

- **One element, any document.** JSON or YAML, AsyncAPI 2.x or 3.x, local file or URL.
- **Rendered in place.** The viewer appears where you put the tag, and every tag on a page renders.
- **Pinned and verified assets.** The viewer script and stylesheet are loaded from a fixed version
  with `integrity` hashes. Self-host them with two config lines. See [Configuration](configuration.md).
- **Safe by construction.** Nothing from your Markdown is interpolated into JavaScript; per-tag data
  travels in HTML-escaped attributes.
- **Strict-mode aware.** Problems surface as build warnings, not as a blank box in production.

## Where next

- [Live demo](demo.md) shows AsyncAPI 2 and 3 documents and several attributes side by side.
- [Attributes](attributes.md) is the full reference.
- [Configuration](configuration.md) covers plugin options, self-hosting and Content Security Policy.
- [Other tools](other-tools.md) covers Zensical, plain Python-Markdown and Material's instant navigation.
- [Migration](migration.md) is for users of the old `mkdocs-asyncapi-tag-plugin` package.

---

Built and maintained by [Weesho Lapara](https://weesholapara.com). Found it useful?
[Buy me a coffee](https://github.com/Weesho-Lapara/asyncapi-tag?sponsor=1).
