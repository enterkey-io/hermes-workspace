# Event stream and browser access

The protocol identifier remains `hermes-bot-web.v1`. Read `bridge_version` from
POST `/v1/connect` to identify implementation behavior. HTTP chunks are transport
details: a chunk can contain part of a UTF-8 character, part of a record, or many
records. Never assume one chunk equals one event.

## GET /v1/events

The media type is `application/x-ndjson`. Each nonempty UTF-8 line is one JSON
object; ignore empty lines. Buffer incomplete lines and incomplete UTF-8
characters across reads. Dispatch a record as soon as its line is complete.

| Integration version    | Record terminator                                 |
| ---------------------- | ------------------------------------------------- |
| 0.2.4 published source | JSON followed by LF (single newline)              |
| 0.4.0                  | JSON followed by LF (single newline)              |
| 0.4.1–0.5.0            | JSON followed by LF LF (compatibility blank line) |

The installed 0.2.4 probe was reported to observe blank separators. The tagged
0.2.4 source emits single newlines; that deployment difference has not been
independently reproduced. 0.4.1 emits a compatibility blank line so both styles
of reader work. A line-based NDJSON reader that skips blanks works across all
three versions. A reader splitting only on blank lines fails on 0.4.0. Future v1
releases retain the blank separator; a framing change requires an explicit
protocol migration.

The first record is `{"type":"bridge.ready"}`. Heartbeats use
`{"type":"bridge.heartbeat"}` approximately every 15 seconds, including when no
bot is selected. Native records are scoped to the authenticated connection's
open sessions. Browser inactivity checks use a 35-second deadline. A socket
staying open without records is insufficient. Proxies must flush headers and
records immediately and disable buffering.

Use exact allowed Origin, Authorization and X-Bot-Connection headers. Credentials
and lease IDs never belong in URLs or diagnostic reports. On EOF, discard a
partial line and reconnect using a fresh authenticated lease; do not replay
mutations.

## Diagnostic cleanup and global revocation

Each probe closes its reader and DELETEs `/v1/connect` using **its own** Origin,
Authorization and X-Bot-Connection. This releases that lease without invalidating
other browsers. Never use global revocation to free slots.

Beginning with 0.4.1, operator-only POST `/v1/pairing/revoke` requires exactly
`{"all":true}`. Empty bodies, false, strings and numbers are rejected without
revoking anything. `hermes bot-web revoke` likewise refuses; deliberate legacy
global revocation requires `hermes bot-web revoke --all`. It clears all temporary
pairing grants and current connection leases. It does not revoke persistent
owner login sessions or already-issued owner tickets; manage those through the
owner account controls. Older releases accepted an empty body and had no CLI
safeguard.

## Workspace presentation in 0.5.0

`workspace.changed` is an authenticated, payload-free invalidation hint. It never
contains another session's events. Clients fetch `workspace.snapshot`, coalesce
concurrent reads, reconcile every five visible seconds as recovery, and refresh
on focus/reconnect and confirmed mutations. The bridge shares a four-second
watcher across connected browsers. No model/provider probe runs in roster reads.

Snapshot IDs identify profile incarnations, not reusable names. Read keys bind
that ID to its native canonical chat. Supported native reads use active-message
row IDs, and SQLite acknowledgments advance with MAX. Crew read keys include the
creation identity and native sequence. Only acknowledge history actually shown
in a visible conversation at the bottom. Missing timestamps/previews stay absent.

`agent.pin`, `agent.hide`, `presentation.order` and `presentation.read` have fixed
validated fields. `agent.delete` can execute only from an exact durable owner
request approved with the profile name. Default/lead profiles, managers with
direct reports, active sessions and live crew members are protected. Executing,
partial and uncertain deletion receipts cannot be approved again.
`requests.reconcile` observes the outcome; it never replays native deletion.

## Optional 0.6 capabilities

The handshake advertises `attachments` and `computer`. Clients must check these;
the protocol name remains `hermes-bot-web.v1`. NDJSON events still contain one
JSON object per LF line; blank lines remain ignorable and heartbeats are 15 s.

Attachments require an open connection-owned native `session_id`:

- `POST /v1/files/upload`, normal auth headers and RPC envelope `files.upload`
  with `session_id`, `name`, base64 `data`. It stages privately without a prompt.
  The dedicated body cap is 14 MiB + 4096; decoded files are at most 10 MiB.
- `chat.send` optionally includes `attachments` (1–5 opaque IDs, 25 MiB total)
  and an opaque `request_id`. That ID binds exact content and target. Accepted,
  uncertain and discarded receipts are durable; never automatically resend.
- `files.list`, `files.remove`, `files.reconcile`, `files.discard` use `/v1/rpc`.
  Reconciliation reads history without model execution. Discard is an explicit
  owner action for this conversation's pending inputs. It never revokes clients.
- `POST /v1/files/read`, normal auth/RPC envelope with `files.read`, `session_id`,
  `id`, returns binary octet-stream with attachment disposition and no-store.
  IDs are bound to owner principal, native incarnation and canonical chat.

Typed `crews.save` changes organizational metadata only, with revision CAS and
an operation receipt. Typed `room.create` creates a separate native Group chat
with an opaque room ID, name and 2–6 distinct managed profile names. Neither
operation grants tool access or sends a prompt; group membership is frozen by
these native revisions.

Computer uses typed profile-scoped `computer.status/start/stop/observe/control/
release/force_release`. Observe returns a 25-second, one-use ticket, never a
native socket/port, internal credential or reusable native display ticket. The
browser opens binary WebSocket `/v1/computer/stream?ticket=…`; the route requires
exact Host/Origin, consumes the ticket and remains bound to an active browser
lease and the same native profile incarnation. No cookie becomes bridge auth.
Public tickets and upgrade query strings must not be logged. The fixed private
transport redeems the native ticket in its minting process and keeps native RFB
filtering and leases authoritative. Deliberate close hands back; an abnormal
connection loss retains the human lease. At most four streams are active, with
one per connection/profile. Native revision, host and dependency checks determine
whether the optional Computer UI is offered.

The 0.6 Computer capability stays false by default until host acceptance passes.
The operator-only experimental opt-in is `HERMES_BOT_WEB_EXPERIMENTAL_COMPUTER=1`;
it does not bypass the native revision/host/lease checks.
