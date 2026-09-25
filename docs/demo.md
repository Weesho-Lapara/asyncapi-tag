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

## Error handling (this one is meant to fail)

The tag below points at a host that does not exist, to show what readers see when a document cannot
be loaded: a message in place of the viewer, naming the URL, instead of a blank box. A wrong local path
is caught earlier, at build time, because `mkdocs build --strict` fails on it.

```markdown
<asyncapi-tag src="https://example.invalid/asyncapi.yaml"></asyncapi-tag>
```

<asyncapi-tag src="https://example.invalid/asyncapi.yaml"></asyncapi-tag>
