# Hermes Bot Mode compatibility results

14 October 2026. **A working local web/plugin preview exists; the public hosted release is not certified.**

| Path                                                | Result                                                                                                                              | Limits                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Optional bot-web plugin, pinned Hermes 0.21.0       | Actual managed bots, canonical chat/streaming, teammate delivery, room driver, owned routine listing, approval denial and Stop pass | Disposable homes and deterministic local model           |
| Built web app → plugin across local HTTPS origins   | Six actual browser tests pass, including proof-bound pairing, denied origins, privacy/storage, loss handling, native approvals/Stop | Test certificate exception; no public-network deployment |
| Stock Hermes dashboard → independent public web app | Earlier runtime/source checks still demonstrate tested origin/auth restrictions                                                     | The plugin does not alter or bypass these guards         |

The adapter matches complete tested native gateway fingerprint bundles and refuses unknown or mixed bundles. Distribution metadata is advisory; the tested af0cd4df source declares 0.0.0 by design. `hermes bot-web doctor` reports this without reading private configuration or making model calls. The CLI registration is a supported Hermes plugin extension; starting the room service is a version-specific internal lifecycle adapter. Normal canonical resume is essential: the upstream observer-only lazy mode is unsuitable for an interactive Bot Chat and was rejected after native approval testing.

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

## 0.2.1 Docker-source revalidation

`af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a` from the public `enterkey-io/hermes-agent` fork (reported as Hermes 0.21.7) passed the full native fixture, six separate-origin browser tests and the packaged CLI doctor/setup/serve/approval/revocation/roster smoke. Its real distribution metadata is 0.0.0; no version override or native source patch was used. The previous 29112bef build also passed native regression tests.

The new engine emits approval server requests while retaining authoritative approval.pending/respond RPCs. The adapter translates the notification and reconnect replay into session-scoped browser approval refreshes; exact native pending request validation still governs responses, with only Once/Deny. Unsupported secret/sudo/desktop requests receive an explicit unsupported-method response; no answer or generic browser responder is invented.

Tests ran in isolated macOS Python 3.14/3.12 environments against exact source; the owner's live Docker installation, SSH tunnel, ingress and browser path still require the installing agent's checks. See af0cd4df.json for recorded evidence.

## Owner-agent installation report

On 14 October, the owner forwarded their agent's successful installation report for plugin 0.2.1 on the actual af0cd4df container. The agent reported matching all five fingerprints, private configuration mode 0600, an independently selected loopback port after finding an occupied default, and successful HTTP checks through the real private HTTPS/SSH route. Allowed-origin preflight returned 204 with the exact origin; unapproved-origin and unauthenticated requests returned 403; the independently hosted web app returned 200. Existing web and other ingress routes were preserved.

This is **owner-agent-reported deployment evidence**, not an independent test by the development agent. Owner browser pairing and native roster verification remain pending. The bridge and tunnel run as background processes; permanent restart supervision is not configured, and a gateway/pod restart requires relaunch. It does not certify a public Cloudflare-to-home deployment or full browser Bot Mode operation. The sanitized report is recorded in [owner-install-report.json](owner-install-report.json); earlier fixture records retain their original scope.

The owner subsequently supplied a browser screenshot: pairing reached the workspace, the initial native lists contained zero bots/rooms, and the live event stream failed. Code inspection establishes that this workspace appears only after successful list responses; the screenshot does not establish why the native roster is empty or why streaming failed. An unauthenticated event-stream preflight through the actual ingress returned 204 from the development host; authenticated streaming and the owner's Hermes home/profile readiness still need local agent diagnosis. This supersedes the earlier pending-pairing status without implying a working native chat.

The corrected onboarding supplies native first-bot setup instructions and separate stream status, waits for `bridge.ready` before enabling chat, supports read-only roster refresh after initialization, and distinguishes empty lists from list failures. Native first-bot creation/title/reuse passed on both supported sources in isolated homes with zero model turns. All nine browser regression cases passed against the af0cd4df fixture (the empty-roster case passed after fixing its test's zero-height navigation assertion), along with 47 unit tests and the production build. These regressions do not resolve or certify the owner's live stream path.

## Reported missing heartbeats and reproduced bridge defect

The owner's agent subsequently reported that the intended Hermes home was correct, managed/initialized bot counts were both zero, and both loopback and actual HTTPS streams returned 200 plus immediate readiness but **no heartbeats in 50 seconds**. The agent also reported invalidating all browser grants while cleaning up diagnostic probes. The sanitized evidence is [owner-stream-report.json](owner-stream-report.json). Its suggestion that the screenshot came from an earlier port outage remains a hypothesis; the current silent stream itself fails the client's 35-second idle deadline.

Code inspection identified that the old heartbeat timer restarted whenever a native queue item arrived, including events filtered out of that browser's session scope. A regression with continuously filtered traffic failed before the fix. Plugin 0.2.3 schedules independent heartbeat deadlines and rechecks lease/grant validity after waiting for an event. Idle and busy-filtered ASGI streams pass, and closing an operator probe is tested to preserve an unrelated owner browser grant. Diagnostic instructions now require closing only that probe's lease; global revocation is explicitly not cleanup. The [agent repair procedure](../AGENT_REPAIR.md) combines the code update, native Bot Mode initialization and fresh owner pairing. Deployment verification of the fixed plugin on the owner's host remains pending.

The actual af0cd4df native fixture stream emitted readiness at 54 ms and heartbeats at 15.06, 30.06 and 45.06 seconds during a 50-second HTTPS observation. All nine browser tests passed, including an empty roster kept idle for 40 seconds without losing the stream. Native canonical continuity, teammate delivery, room driver, routine listing, approval denial and Stop also passed with 17 deterministic local model turns. 31 Python boundary tests and 47 TypeScript tests passed. These are isolated fixture results with a test certificate exception, recorded in [heartbeat-fix.json](heartbeat-fix.json), not verification of an upgrade on the owner's host.
