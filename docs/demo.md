# Live demo

Everything on this page is rendered by `asyncapi-tag` from the two example documents in
`docs/examples/`. The Markdown for each section is shown above its viewer.

## AsyncAPI 3 document (YAML)

```markdown
<asyncapi-tag src="examples/orders-v3.yaml" sidebar="false" sendLabel="EMIT" receiveLabel="ON"></asyncapi-tag>
```

<asyncapi-tag src="examples/orders-v3.yaml" sidebar="false" sendLabel="EMIT" receiveLabel="ON"></asyncapi-tag>

## AsyncAPI 2 document (JSON) with a sidebar grouped by tags

```markdown
<asyncapi-tag src="examples/accounts-v2.json" showServers="bySpecTags" showOperations="bySpecTags" messageExamples="false"></asyncapi-tag>
```

<asyncapi-tag src="examples/accounts-v2.json" showServers="bySpecTags" showOperations="bySpecTags" messageExamples="false"></asyncapi-tag>

## Missing document

A wrong path is reported at build time (`mkdocs build --strict` fails) and, if it slips through,
shown in place instead of a blank box:

```markdown
<asyncapi-tag src="https://example.invalid/asyncapi.yaml"></asyncapi-tag>
```

<asyncapi-tag src="https://example.invalid/asyncapi.yaml"></asyncapi-tag>
