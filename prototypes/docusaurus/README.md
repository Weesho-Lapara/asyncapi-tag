# Docusaurus prototype (not published, not tested in CI)

Proof of concept from 2026-09-25 showing the same authoring syntax in Docusaurus 3. See
[ROADMAP.md](../../ROADMAP.md#docusaurus-support) for the evaluation and what shipping it would take.

Drop-in steps for a Docusaurus 3 site:

1. `npm install unist-util-visit`
2. Copy `remark-asyncapi-tag.js` to `plugins/` and `AsyncApiTag.js` to `src/components/`.
3. In `docusaurus.config.js`, under the docs preset:
   `remarkPlugins: [require('./plugins/remark-asyncapi-tag')]`
4. Append the containment rules from `src/asyncapi_tag/assets.py` (`EMBED_CSS`) to `src/css/custom.css`.
5. Put AsyncAPI files under `static/` and reference them site-root relative (`/asyncapi/orders.yaml`).
   `demo-page.md` shows both syntaxes.

The viewer version and SRI hashes in `AsyncApiTag.js` are copied from `assets.py` and are not kept
in sync automatically.
