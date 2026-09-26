# Coverage report

Generated 2026-09-26 by `npm run coverage` against the examples/ folder of asyncapi/spec at master `1dd65fd` and v2.6.0 `1824379`, plus our own example documents and fixtures.
Review this file by hand after each run; chunk 1.8b of the roadmap fixes what it shows.

| | Count |
|---|---|
| Documents | 69 |
| Normalised | 60 |
| With problems | 6 |
| With invariant violations | 0 |
| Failed (threw or unparsable) | 0 |
| Skipped (not AsyncAPI 2 or 3) | 9 |

## Problem kinds

| Count | Message (values elided) |
|---|---|
| 3 | A trait must not define "…"; that field of the trait at "…" was ignored. |
| 2 | Circular $ref chain at "…". |
| 1 | Could not load "…" for $ref "…": HTTP N |
| 1 | Could not load "…" for $ref "…": fetch failed |
| 1 | Could not resolve $ref "…": HTTP N. |
| 1 | Could not resolve $ref "…": fetch failed. |
| 1 | Could not resolve $ref "…": nothing at "…". |
| 1 | Operation "…" does not reference a channel in "…". It was skipped. |
| 1 | Operation "…" has action "…"; expected send or receive. It was skipped. |
| 1 | Security scheme "…" is not defined in components.securitySchemes. |
| 1 | Channel "…" lists server "…" which is not in "…"; it was ignored. |
| 1 | Channel "…" has neither publish nor subscribe, so nothing is shown for it. |
| 1 | Operation "…" uses channel "…", which defines no messages. |

## Documents

Ops msgs: messages reached through operations. No payload: messages without a payload schema. Raw: messages whose payload is not JSON Schema (shown as a code block).

| Set | Document | Version | Servers | Ops | Ops msgs | Component msgs | No payload | Raw | Schemas | Problems | Violations |
|---|---|---|---|---|---|---|---|---|---|---|---|
| asyncapi/spec examples (master) | adeo-kafka-request-reply-asyncapi.yml | 3.1.0 | 3 | 1 | 1 | 2 |  |  | 10 | 0 |  |
| asyncapi/spec examples (master) | anyof-asyncapi.yml | 3.1.0 | 0 | 1 | 1 | 1 |  |  | 2 | 0 |  |
| asyncapi/spec examples (master) | application-headers-asyncapi.yml | 3.1.0 | 1 | 1 | 1 | 1 |  |  | 3 | 0 |  |
| asyncapi/spec examples (master) | correlation-id-asyncapi.yml | 3.1.0 | 1 | 2 | 2 | 2 |  |  | 3 | 0 |  |
| asyncapi/spec examples (master) | gitter-streaming-asyncapi.yml | 3.1.0 | 1 | 1 | 2 | 2 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | kraken-websocket-request-reply-message-filter-in-reply-asyncapi.yml | 3.1.0 | 0 | 5 | 5 | 8 |  |  | 20 | 0 |  |
| asyncapi/spec examples (master) | kraken-websocket-request-reply-multiple-channels-asyncapi.yml | 3.1.0 | 0 | 5 | 5 | 8 |  |  | 20 | 0 |  |
| asyncapi/spec examples (master) | mercure-asyncapi.yml | 3.1.0 | 1 | 2 | 2 | 1 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | not-asyncapi.yml | 3.1.0 | 0 | 1 | 1 | 1 |  |  | 1 | 0 |  |
| asyncapi/spec examples (master) | oneof-asyncapi.yml | 3.1.0 | 0 | 2 | 3 | 3 |  |  | 2 | 0 |  |
| asyncapi/spec examples (master) | operation-security-asyncapi.yml | 3.1.0 | 0 | 1 | 1 | 1 |  |  | 3 | 0 |  |
| asyncapi/spec examples (master) | rpc-client-asyncapi.yml | 3.1.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | rpc-server-asyncapi.yml | 3.1.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | simple-asyncapi.yml | 3.1.0 | 0 | 1 | 1 | 1 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | slack-rtm-asyncapi.yml | 3.1.0 | 1 | 2 | 47 | 48 |  |  | 1 | 0 |  |
| asyncapi/spec examples (master) | social-media/backend/asyncapi.yaml | 3.1.0 | 2 | 4 | 4 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | social-media/comments-service/asyncapi.yaml | 3.1.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | social-media/common/messages.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (master) | social-media/common/parameters.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (master) | social-media/common/schemas.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (master) | social-media/common/servers.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (master) | social-media/frontend/asyncapi.yaml | 3.1.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | social-media/notification-service/asyncapi.yaml | 3.1.0 | 1 | 1 | 1 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | social-media/public-api/asyncapi.yaml | 3.1.0 | 1 | 1 | 1 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (master) | streetlights-kafka-asyncapi.yml | 3.1.0 | 2 | 4 | 4 | 3 |  |  | 4 | 0 |  |
| asyncapi/spec examples (master) | streetlights-mqtt-asyncapi.yml | 3.1.0 | 1 | 4 | 4 | 3 |  |  | 4 | 0 |  |
| asyncapi/spec examples (master) | streetlights-operation-security-asyncapi.yml | 3.1.0 | 2 | 4 | 4 | 3 |  |  | 4 | 0 |  |
| asyncapi/spec examples (master) | websocket-gemini-asyncapi.yml | 3.1.0 | 1 | 1 | 1 | 1 |  |  | 5 | 0 |  |
| asyncapi/spec examples (v2.6.0) | anyof.yml | 2.6.0 | 0 | 1 | 1 | 1 |  |  | 2 | 0 |  |
| asyncapi/spec examples (v2.6.0) | application-headers.yml | 2.6.0 | 1 | 1 | 1 | 1 |  |  | 3 | 0 |  |
| asyncapi/spec examples (v2.6.0) | correlation-id.yml | 2.6.0 | 1 | 2 | 2 | 2 |  |  | 3 | 0 |  |
| asyncapi/spec examples (v2.6.0) | gitter-streaming.yml | 2.6.0 | 1 | 1 | 2 | 2 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | mercure.yml | 2.6.0 | 1 | 2 | 2 | 1 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | not.yml | 2.6.0 | 0 | 1 | 1 | 1 |  |  | 1 | 0 |  |
| asyncapi/spec examples (v2.6.0) | oneof.yml | 2.6.0 | 0 | 2 | 3 | 3 |  |  | 2 | 0 |  |
| asyncapi/spec examples (v2.6.0) | operation-security.yml | 2.6.0 | 0 | 1 | 1 | 1 |  |  | 3 | 0 |  |
| asyncapi/spec examples (v2.6.0) | rpc-client.yml | 2.6.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | rpc-server.yml | 2.6.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | simple.yml | 2.6.0 | 0 | 1 | 1 | 1 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | slack-rtm.yml | 2.6.0 | 1 | 2 | 47 | 48 |  |  | 1 | 0 |  |
| asyncapi/spec examples (v2.6.0) | social-media/backend/asyncapi.yaml | 2.6.0 | 2 | 4 | 4 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | social-media/comments-service/asyncapi.yaml | 2.6.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | social-media/common/messages.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (v2.6.0) | social-media/common/schemas.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (v2.6.0) | social-media/common/servers.yaml |  |  |  |  |  |  |  |  | skipped |  |
| asyncapi/spec examples (v2.6.0) | social-media/frontend/asyncapi.yaml | 2.6.0 | 1 | 2 | 2 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | social-media/notification-service/asyncapi.yaml | 2.6.0 | 1 | 1 | 1 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | social-media/public-api/asyncapi.yaml | 2.6.0 | 1 | 1 | 1 | 0 |  |  | 0 | 0 |  |
| asyncapi/spec examples (v2.6.0) | streetlights-kafka.yml | 2.6.0 | 2 | 4 | 4 | 3 |  |  | 4 | 0 |  |
| asyncapi/spec examples (v2.6.0) | streetlights-mqtt.yml | 2.6.0 | 1 | 4 | 4 | 3 |  |  | 4 | 0 |  |
| asyncapi/spec examples (v2.6.0) | streetlights-operation-security.yml | 2.6.0 | 2 | 4 | 4 | 3 |  |  | 4 | 0 |  |
| asyncapi/spec examples (v2.6.0) | websocket-gemini.yml | 2.6.0 | 1 | 1 | 1 | 1 |  |  | 5 | 0 |  |
| docs/examples | accounts-v2.json | 2.6.0 | 2 | 2 | 2 | 2 |  |  | 0 | 0 |  |
| docs/examples | adeo-kafka-request-reply.yaml | 3.1.0 | 3 | 1 | 1 | 2 |  |  | 10 | 0 |  |
| docs/examples | orders-v3.yaml | 3.0.0 | 2 | 2 | 2 | 2 |  |  | 1 | 0 |  |
| viewer/test/fixtures/docs | avro-v2.yaml | 2.6.0 | 0 | 1 | 1 | 1 |  |  | 0 | 0 |  |
| viewer/test/fixtures/docs | avro-v3.yaml | 3.0.0 | 0 | 1 | 2 | 3 |  | 1 | 0 | 0 |  |
| viewer/test/fixtures/docs | circular.yaml | 3.0.0 | 0 | 0 | 0 | 0 |  |  | 2 | 2 |  |
| viewer/test/fixtures/docs | composition.yaml | 3.0.0 | 0 | 3 | 3 | 0 |  |  | 5 | 0 |  |
| viewer/test/fixtures/docs | external-ref.yaml | 3.0.0 | 0 | 1 | 1 | 0 |  |  | 1 | 4 |  |
| viewer/test/fixtures/docs | multi-message.yaml | 3.0.0 | 0 | 2 | 5 | 2 |  |  | 0 | 3 |  |
| viewer/test/fixtures/docs | nested-six.yaml | 3.0.0 | 0 | 1 | 1 | 0 |  |  | 1 | 0 |  |
| viewer/test/fixtures/docs | oneof-v2.yaml | 2.4.0 | 0 | 3 | 5 | 2 |  |  | 0 | 0 |  |
| viewer/test/fixtures/docs | parameters-v2.yaml | 2.6.0 | 2 | 2 | 2 | 1 |  |  | 0 | 2 |  |
| viewer/test/fixtures/docs | request-reply.yaml | 3.0.0 | 1 | 2 | 3 | 2 |  |  | 0 | 0 |  |
| viewer/test/fixtures/docs | shared/messages.yaml |  |  |  |  |  |  |  |  | skipped |  |
| viewer/test/fixtures/docs | shared/schemas.yaml |  |  |  |  |  |  |  |  | skipped |  |
| viewer/test/fixtures/docs | traits-v2.yaml | 2.6.0 | 0 | 1 | 1 | 1 |  |  | 0 | 2 |  |
| viewer/test/fixtures/docs | traits-v3.yaml | 3.0.0 | 1 | 2 | 1 | 1 |  |  | 0 | 3 |  |

## Failed and skipped

- **asyncapi/spec examples (master) / social-media/common/messages.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **asyncapi/spec examples (master) / social-media/common/parameters.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **asyncapi/spec examples (master) / social-media/common/schemas.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **asyncapi/spec examples (master) / social-media/common/servers.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **asyncapi/spec examples (v2.6.0) / social-media/common/messages.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **asyncapi/spec examples (v2.6.0) / social-media/common/schemas.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **asyncapi/spec examples (v2.6.0) / social-media/common/servers.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **viewer/test/fixtures/docs / shared/messages.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)
- **viewer/test/fixtures/docs / shared/schemas.yaml**: skipped: not an AsyncAPI document (no "asyncapi" field)

## Problems and violations per document

### viewer/test/fixtures/docs / circular.yaml

- error at `/components/schemas/A`: Circular $ref chain at "<repo>/viewer/test/fixtures/docs/circular.yaml#/components/schemas/B".
- error at `/components/schemas/B`: Circular $ref chain at "<repo>/viewer/test/fixtures/docs/circular.yaml#/components/schemas/A".

### viewer/test/fixtures/docs / external-ref.yaml

- error at `/components/schemas/Broken`: Could not load "<repo>/viewer/test/fixtures/docs/missing.yaml" for $ref "missing.yaml#/Nope": HTTP 404
- error at `/components/schemas/Deep`: Could not load "https://schemas.example.com/common.json" for $ref "https://schemas.example.com/common.json#/definitions/Address": fetch failed
- error at `/components/schemas/Broken`: Could not resolve $ref "missing.yaml#/Nope": HTTP 404.
- error at `/components/schemas/Deep`: Could not resolve $ref "https://schemas.example.com/common.json#/definitions/Address": fetch failed.

### viewer/test/fixtures/docs / multi-message.yaml

- error at `/operations/broken/channel`: Could not resolve $ref "#/channels/nope": nothing at "/channels/nope".
- error at `/operations/broken/channel`: Operation "broken" does not reference a channel in "channels". It was skipped.
- error at `/operations/wrongAction/action`: Operation "wrongAction" has action "publish"; expected send or receive. It was skipped.

### viewer/test/fixtures/docs / parameters-v2.yaml

- warning at `/servers/prod/security/2`: Security scheme "ghost" is not defined in components.securitySchemes.
- warning at `/channels/rooms~1{roomId}~1messages~1{kind}/servers/1`: Channel "rooms/{roomId}/messages/{kind}" lists server "nope" which is not in "servers"; it was ignored.

### viewer/test/fixtures/docs / traits-v2.yaml

- warning at `/channels/orders/subscribe/traits/1`: A trait must not define "message"; that field of the trait at "/channels/orders/subscribe/traits/1" was ignored.
- warning at `/channels/quiet`: Channel "quiet" has neither publish nor subscribe, so nothing is shown for it.

### viewer/test/fixtures/docs / traits-v3.yaml

- warning at `/components/messages/Order/traits/0`: A trait must not define "payload"; that field of the trait at "/components/messages/Order/traits/0" was ignored.
- warning at `/operations/emitOrder/traits/1`: A trait must not define "action"; that field of the trait at "/operations/emitOrder/traits/1" was ignored.
- warning at `/operations/onNothing/channel`: Operation "onNothing" uses channel "empty", which defines no messages.
