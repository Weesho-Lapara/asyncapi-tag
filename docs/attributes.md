# Attributes

Only `src` is required. Attribute names are case-insensitive. Boolean attributes accept
`true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`; a bare attribute means `true`.

| Attribute | Values | Default | Effect |
|---|---|---|---|
| `src` | path or URL | required | The AsyncAPI document (JSON or YAML) |
| `id` | string | `asyncapi-tag-N` | HTML id of the container element |
| `sidebar` | boolean | `false` | Show the navigation sidebar (a toggle button inside the viewer when the column is narrow) |
| `info` | boolean | `true` | Show the info section |
| `servers` | boolean | `true` | Show servers |
| `operations` | boolean | `true` | Show operations |
| `messages` | boolean | `true` | Show messages |
| `schemas` | boolean | `true` | Show schemas |
| `errors` | boolean | `true` | Show parser errors |
| `showMessageExamples` | boolean | viewer default | Show examples for standalone messages |
| `messageExamples` | boolean | `true` | Expand message examples |
| `showServers` | `byDefault`, `bySpecTags`, `byServersTags` | `byDefault` | How the sidebar groups servers |
| `showOperations` | `byDefault`, `bySpecTags`, `byOperationsTags` | `byDefault` | How the sidebar groups operations |
| `useChannelAddressAsIdentifier` | boolean | viewer default | AsyncAPI 3: label operations by channel address |
| `publishLabel`, `subscribeLabel` | string | `PUB`, `SUB` | Operation labels for AsyncAPI 2 |
| `sendLabel`, `receiveLabel`, `requestLabel`, `replyLabel` | string | `SEND`, `RECEIVE`, `REQUEST`, `REPLY` | Operation labels for AsyncAPI 3 |
| `parserOptions` | JSON object | viewer default | Passed to the AsyncAPI parser |
| `schemaID` | string | container id | The viewer's `schemaID` option |

These map onto the React component's
[configuration](https://github.com/asyncapi/asyncapi-react/blob/master/docs/configuration/config-modification.md).
The default for `messageExamples` follows earlier releases of this plugin rather than the viewer.

## Examples

Hide the sidebar and collapse examples:

```html
<asyncapi-tag src="events.yaml" sidebar="false" messageExamples="false"></asyncapi-tag>
```

Group the sidebar by tags declared in the document:

```html
<asyncapi-tag src="events.yaml" showServers="bySpecTags" showOperations="bySpecTags"></asyncapi-tag>
```

Custom operation labels for an AsyncAPI 3 document:

```html
<asyncapi-tag src="orders.yaml" sendLabel="EMIT" receiveLabel="ON"></asyncapi-tag>
```

Pass parser options as JSON (single quotes around the attribute keep the JSON readable):

```html
<asyncapi-tag src="events.yaml" parserOptions='{"applyTraits": false}'></asyncapi-tag>
```

Both the paired and the self-closing form are accepted, and a tag may span several lines:

```html
<asyncapi-tag
    src="events.yaml"
    sidebar="false"
/>
```

## Validation

Unknown attributes and invalid values are reported as warnings and skipped; the remaining
attributes still apply. Under MkDocs the warnings go through the MkDocs logger, so
`mkdocs build --strict` fails on them. A tag without `src` renders a visible error in place.

Tags inside fenced or indented code blocks are left alone, which is how this page shows the syntax.
