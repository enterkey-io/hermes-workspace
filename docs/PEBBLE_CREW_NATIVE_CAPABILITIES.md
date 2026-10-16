# Files, Computer and Crew integration findings

Implementation update (0.6.0): private direct-chat uploads/downloads and typed
Crew/Group chat creation are implemented. Real native attachment tool-read and
durable no-replay receipt checks pass on both supported builds. The screen
transport passes real native ticket/control/filter checks with a synthetic
framebuffer; full Linux desktop startup remains a separate gate. See
[release evidence](compatibility/preview-0.6.0-local.json). The research below
records source boundaries, not broader runtime certification.

Research for the 16 October 2026 UX plan. This is a source review, not an
implementation or a verification of the owner's installation. It supplements
the [UX audit](PEBBLE_CREW_UX_AUDIT.md) and
[implementation plan](PEBBLE_CREW_UX_IMPLEMENTATION_PLAN.md).

## What can be built

File attachments have native support in both Hermes revisions currently
supported by Pebble Crew. The web app does not expose it. A real implementation
needs an owner-local upload boundary, session binding and durable attachment
references; a paperclip alone would not deliver the feature.

Hermes also has a real per-profile Computer feature, called Bot Screen. It is
present in the reviewed 0.21.7 source, absent from the reviewed 0.21.0 display
handler surface, and requires a supported Linux execution environment and extra
packages. Pebble Crew does not currently expose its handlers or stream. Plan it
as a separate capability-gated integration, with a working transport prototype
before the Computer tab is offered as an action.

Calling the existing organizational teams **Crews** requires no conversion into
native group conversations. Those are different native entities. Changing a
Crew's membership must not quietly change an existing group chat's participants
or reporting relationships.

## Evidence and compatibility boundaries

The local source checkouts were verified with `git rev-parse HEAD`:

| Hermes build | Reviewed source revision                   | Finding                                                                                                                                                                     |
| ------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.21.0       | `29112bef099274229cadff79cdff7bf7b99c4b77` | `image.attach_bytes`, `pdf.attach`, `file.attach` present in `tui_gateway/methods_prompt.py`; no native `display.status`/`display.observe` handlers found in this checkout. |
| 0.21.7       | `af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a` | Attachment handlers present; `tui_gateway/methods_display.py` implements status, start/stop, thumbnail, observe and control leases.                                         |

The version label alone is not a capability probe. Add exact reviewed dependency
fingerprints and registration/runtime checks for new surfaces. Existing
fingerprints must not be weakened to make a new feature appear supported.
Source presence does not establish that display packages, an image-capable model
or a working sandbox exist on an installed host.

Current official documentation corroborates the newer Bot Screen behavior:
[Hermes Bot Screen](https://hermes-agent.nousresearch.com/docs/user-guide/features/bot-screen).
The pinned source remains the implementation authority for the supported builds.

## Attachments

### Native contracts confirmed by source

In the 0.21.7 source:

- `tui_gateway/methods_prompt.py:941` implements `image.attach_bytes`, taking
  `session_id`, base64 bytes and a filename/extension hint. It queues an image
  for the next native prompt; it is not a neutral file upload.
- `methods_prompt.py:973` implements `pdf.attach`. It renders selected pages
  using `pdftoppm` and queues images. It needs that executable and a vision
  path; it is different from attaching a PDF as a readable file.
- `methods_prompt.py:1030` implements `file.attach`, accepting a `data_url` and
  name for a remote client. It stages the file and returns a native `@file:`
  reference. The submit pipeline must actually include that reference.
- `tui_gateway/prompt_attachments.py:89` anchors staging to the session's
  profile home. Configured workspace storage and remote/sandbox paths change
  where attachments belong; the web app must not invent host paths.
- `prompt_attachments.py:17` defines native image/PDF byte caps of 25 MiB and
  50 MiB, and a 25-page PDF cap. These are native ceilings, not promises made
  by Pebble Crew. Generic `file.attach` must receive a separate bounded upload
  policy; do not assume it inherits the image limit.
- `apps/desktop/src/app/session/hooks/use-prompt-actions/index.ts:125` shows
  native Desktop staging attachments into the bound live session before
  prompt submission. Profile/session switching and retries are material here.

The older revision has analogous handlers at `methods_prompt.py:1135`, `:1196`
and `:1322`. Their implementations/dependencies differ; test both instead of
assuming identical behavior from matching names.

### Current Pebble Crew constraints

`plugins/bot-web/operations.py:153` permits only text for `chat.send` and checks
that the connection opened the exact managed profile/session incarnation.
Preserve that check for upload, staging, download and submission.

`plugins/bot-web/server.py:22,149` limits normal requests to 65,536 bytes; only
the avatar route gets a larger limit. Increasing the global RPC limit would
unnecessarily broaden every operation. Add a dedicated, authenticated, bounded
upload route instead. The owner Node `/api/` body limit is 8,192 bytes
(`apps/owner-node/main.ts:164`); attachment traffic must use its intended bridge
route, not an account API.

The combined proxy also has a fixed route/method allowlist and a 65,536-byte
normal limit (`packages/owner-service/src/bridge-proxy.ts:4–33`). Add the upload
route and its bounded policy there as well; changing the Python server alone
would still leave the packaged app unable to upload.

`plugins/bot-web/native.py:56,143` uses a 4 MiB stdout frame limit and a
45-second native call timeout. Native PDF rendering can run for 120 seconds.
Large inline history responses and long conversions need explicit bounded
handling. Do not globally extend every call timeout or retransmit all image
bytes whenever history refreshes.

### Recommended implementation contract

1. Let pick/paste/drop create an attachment chip in the current conversation's
   draft. Display filename, type, size, progress and remove/retry actions.
   No model call and no native image queue mutation just for opening a picker.
2. Upload bytes directly to the owner's installation. The server selects the
   destination and returns an opaque upload ID scoped to owner, stable profile
   incarnation and canonical conversation. Reject client-selected filesystem
   paths, traversal, symlinks and cross-profile IDs. Authenticate before reading
   bytes; bound decoded size, count, total storage and concurrent work.
3. Use a documented initial product budget, proposed as 10 MiB per file,
   5 attachments and 25 MiB per send, subject to the native prototype. This is
   a proposed policy, not an existing capability. Stream to private temporary
   storage and account for base64 expansion at the native boundary.
4. On Send, resolve the current native session again and serialize staging plus
   submission per conversation. Keep native `file.attach` references and image
   queue ownership together. Attachment-only sends require an explicit schema
   change; the existing nonempty-text rule cannot simply remain unchanged.
5. Record receipts for staging and submission. A connection failure must not
   blindly repeat file creation or resend a prompt. Preserve the draft while
   reconciling an uncertain result; clean up only files owned by the failed
   draft, never another tab's pending images.
6. Store a lightweight owner-local attachment index for conversation history
   and the Files tab. Use opaque IDs for reads/downloads, private no-store
   responses and safe disposition/MIME handling. Never render arbitrary HTML
   or SVG on the authenticated app origin. Do not add general filesystem
   browsing or automatically fetch remote links as part of this feature.
7. Cancelled/abandoned staged uploads expire; sent references remain available
   according to an explicit owner retention policy. Removing a draft chip is
   different from deleting a file already referenced in history. Existing
   native history references need a verified scoped import path, not a scan of
   every file in the profile's home.

Start with direct pebble chats. Group-chat attachments need their own delivery
proof: native `gateway/hosted_room_discussion.py:198` validates a text/thread
payload, while Desktop's group-attachment UI has additional delivery machinery.
The existence of a Desktop picker does not establish that Pebble Crew's native
`room.send` path can deliver files. Verify model/tool receipt for every member
before offering group attachments; never upload successfully and discard them
at send time.

Verification must include two tabs, a profile switch during upload, a replaced
profile with the same name, restart, cancellation, duplicate filenames, quota
failure, MIME mismatch, cross-profile access, malicious filenames, model vision
unavailable, and an uncertain native submit. Confirm one file reaches the real
selected agent and survives a history reload on each supported native revision.

## Computer

### Native behavior confirmed by source

`tui_gateway/methods_display.py:50–107` provides profile-scoped status,
thumbnail and start/stop. `:149–168` mints a viewer and short-lived ticket;
`:234–268` handles Take over / Hand back. The native web route
`hermes_cli/web_routers/display.py:82` transports RFB over WebSocket and enforces
control using `RfbClientFilter`; the browser's `viewOnly` property is not the
security boundary.

This can provide a distinct screen/browser profile per pebble on a suitable
Linux host. It does not create an isolated VM per agent. Native documentation
explicitly says profiles can share OS-user privileges, files and network.
Sandbox placement also depends on the terminal backend. Never claim that the
visual screen itself provides a security boundary.

### Transport issue that must be solved first

The native ticket registry in
`hermes_cli/dashboard_auth/ws_tickets.py:25–63` is **in memory per process**.
Pebble Crew runs a separate persistent stdio child. A ticket minted there is
not automatically consumable by another process running Hermes's dashboard
WebSocket route. A simple new iframe or reverse proxy URL is insufficient.

Prototype a fixed, profile-scoped native viewer adapter that keeps minting and
redemption in the same trusted process, or a correctly authenticated native
transport with that property. Reuse native RFB filtering and control leases.
Keep owner authentication, allowed origins and stable profile identity at the
web boundary. Do not mount the entire native dashboard, expose raw VNC ports,
trust client-provided home/socket paths, make durable tokens into URL secrets,
or weaken Hermes's dashboard authorization to make the viewer connect.

The combined owner server currently proxies HTTP bridge traffic, so WebSocket
upgrade support and proxy timeouts also need explicit tests. The optional
separately hosted app needs its own owner-controlled secure transport proof;
it must not acquire a product-operated screen relay.

### Recommended feature gate and viewer lifecycle

- Read-only capability/status first: distinguish unsupported native revision,
  unsupported host/backend, packages missing, stopped, running and blocked.
  An unavailable feature should have a concise reason, not a fake live screen.
- Do not install packages, change sandbox images, start a screen or ask for a
  sudo password during ordinary page load. `NativeGateway._server_request`
  currently declines unsupported prompts, including native installer prompts.
  Installer support is separate owner-authorized work.
- Lazy-load one viewer when Computer is opened. Start in Watch mode; explicit
  owner action takes control. Enforce both server-side and native input gates.
  Stop receiving screen data when the viewer is closed or no longer authorized.
- Preserve native distinctions between deliberate close and network loss.
  Native close hands control back; a lost network while a human controls the
  screen retains the lease. Test reconnect, another viewer taking control and
  an explicit forced hand-back. Do not silently hand the agent a screen where
  the owner may be halfway through login.
- Prove safe viewer identity across browser grants and native reconnections:
  the shared stdio transport cannot substitute for per-viewer ownership.
  Ticket expiry/replay, cross-profile substitution, revocation, hidden tabs,
  backpressure and disposal all need integration tests.

Release direct file support independently if Computer cannot yet pass this
gate. The planned Computer component can be designed without exposing a
nonfunctional action in the shipped app.

## Crews and existing group chats

Native `apps/desktop/src/plugins/hermes-bots/user-sections.ts:1–20` describes
folders stored via each profile's `sectionId`/`sectionName`. Each profile is
assigned to one such section; this is the source of today's `teams` state.
`plugins/bot-web/workspace.py:513–546` mirrors those fields. Rename the product
surface to **Crews**, retaining stable stored IDs and internal `teams` keys
until a versioned migration is actually needed.

Native `groups.create` (`tui_gateway/methods_groups.py:357`) creates a separate
hosted conversation. The discussion roster is frozen and validates 2–6 members
in the reviewed newer source (`gateway/hosted_room_discussion.py:253`). A Crew
can be larger, so Start group chat must let the owner choose supported members.
An existing native group must retain its room ID, participants and history.

The current plugin exposes list/state/send/stop for rooms but no public
`room.create`. Add a typed, reviewed adapter if group-chat creation is included
in the implementation. Organizing a Crew must not trigger model execution,
alter reporting, duplicate profiles or silently create a room. A later
conversation with different participants is a new native conversation under
the current contract, not a cosmetic edit to an existing one.

The experimental Computer viewer remains disabled by default while Linux
acceptance is open. Explicit operator-only test opt-in is
`HERMES_BOT_WEB_EXPERIMENTAL_COMPUTER=1`; native revision/host checks still apply.
