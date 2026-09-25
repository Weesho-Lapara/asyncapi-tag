---
sidebar_position: 1
title: AsyncAPI in Docusaurus
---

# AsyncAPI in Docusaurus

Same syntax as the Python package. Fenced block:

```asyncapi
src: /asyncapi/orders-v3.yaml
sendLabel: EMIT
receiveLabel: ON
```

Element form, with the sidebar on:

<asyncapi-tag src="/asyncapi/accounts-v2.json" sidebar="true" showServers="bySpecTags" />

And a failing one, to show the error handling:

```asyncapi https://example.invalid/asyncapi.yaml
```
