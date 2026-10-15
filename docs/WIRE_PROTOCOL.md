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
| 0.4.1                  | JSON followed by LF LF (compatibility blank line) |

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
