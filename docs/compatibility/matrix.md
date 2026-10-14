# Hermes Bot Mode compatibility results

14 October 2026. **A working local web/plugin preview exists; the public hosted release is not certified.**

| Path                                                | Result                                                                                                                              | Limits                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Optional bot-web plugin, pinned Hermes 0.21.0       | Actual managed bots, canonical chat/streaming, teammate delivery, room driver, owned routine listing, approval denial and Stop pass | Disposable homes and deterministic local model           |
| Built web app → plugin across local HTTPS origins   | Six actual browser tests pass, including proof-bound pairing, denied origins, privacy/storage, loss handling, native approvals/Stop | Test certificate exception; no public-network deployment |
| Stock Hermes dashboard → independent public web app | Earlier runtime/source checks still demonstrate tested origin/auth restrictions                                                     | The plugin does not alter or bypass these guards         |

The adapter verifies the hashes of its internal native gateway integration files and refuses untested builds. The CLI registration is a supported Hermes plugin extension; starting the room service is a version-specific internal lifecycle adapter. Normal canonical resume is essential: the upstream observer-only lazy mode is unsuitable for an interactive Bot Chat and was rejected after native approval testing.

Runtime gate details are in `integration-evidence.json`. Routine ownership/listing passed; routine execution, public Cloudflare-to-home reachability/certificate trust and compaction under pressure still require release evidence. `npm run compatibility:gate` intentionally returns nonzero until the full hosted-release contract is proven.

The current separate-origin suite loads the full app on a static HTTPS host and reaches an API-only real Hermes bridge at another origin. The browser never redirects to Hermes, and only native API/pairing/events receive private requests. These local results do not certify public-to-private browser networking or production hosting. The optional integration currently supplies native RPC, not a registered messaging platform channel.

## Historical stock-interface investigation

12 October 2026. No revision is certified for the hosted web product.

| Revision                                   | Evidence                                                   | Hosted Bot Mode verdict                                                      |
| ------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `29112bef099274229cadff79cdff7bf7b99c4b77` | Source audit and isolated actual dashboard HTTP/auth probe | Blocked in the tested configuration                                          |
| `1fd18277267152893a8a24792b79213e7ca3f899` | Source audit                                               | Not certified; localhost dashboard CORS and loopback native redirects remain |
| `53df274b08f2bbbe82bb67bb50c7571952e95809` | Source fetched and audited on 12 October                   | Not certified; the same source restrictions remain                           |

The runtime fixture uses normal built-in password authentication, a temporary Hermes home and no inherited provider credentials. Normal sign-in and authenticated WebSocket ticket creation return HTTP 200. An authenticated HTTP origin probe from a public-style application origin returns HTTP 400 without an allowing CORS header. The equivalent localhost-origin probe returns HTTP 200 with an allowing header. Unauthenticated ticket creation returns HTTP 401. A native authorization request using an HTTPS application callback returns HTTP 400.

These probes exercise unmodified Hermes HTTP/auth handlers. Supplying a synthetic cookie explicitly in an HTTP probe is **not** proof that a browser can acquire or send that cookie across sites. No browser TLS, full managed-roster execution, canonical compaction, native handoff, room driver or routine execution has been certified. No origin was forged to claim a passing hosted-browser connection, and no Hermes source was patched.

## Historical missing connection contract

A separate hosted browser application needs a supported public-client authentication flow and authorized access to the native Bot Mode interfaces. Agent REST bearer authentication and its CORS setting do not supply dashboard authentication or its independent origin policy.

The next required investigation is a supported external-web-client contract for managed roster, canonical sessions, native teammate delivery, rooms and routines. A narrowly declared browser origin, suitable short-lived authentication and native interface access must be implemented or configured by Hermes through supported boundaries. Same-origin self-hosting is a different topology and cannot certify the Cloudflare-hosted application. No mandatory connector, plugin, vendor proxy or weakened guard is assumed.

## Historical evidence files

- `source-evidence.json`: reproducible immutable-revision source inventory; not runtime certification.
- `runtime-auth-evidence.json`: local actual-handler results; synthetic data only.

Run `npm run compatibility:gate` before claiming a working hosted Bot Mode product. Its nonzero exit is intentional while the required acceptance gates remain unresolved.
