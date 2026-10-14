# Hosted web client interface gap

## Required outcome

An independently hosted browser must authenticate directly to a user's Hermes and operate its native Bot Mode: managed roster, canonical conversations, teammate delivery, existing rooms, bot-owned routines, approvals and stopping. User contents and credentials cannot be proxied through or stored by the vendor service.

## Observed gap

The audited agent REST API provides runtime operations but not the full managed roster/room interface. The native dashboard interface has its own authentication and origin restrictions. In the isolated 0.21 runtime, normal password sign-in and ticket creation succeed, while an authenticated public-style origin probe fails CORS. Its native authorization flow rejects an HTTPS browser callback. The newer immutable source revisions in the compatibility matrix retain those restrictions.

The current evidence does not establish a supported stock configuration that gives our separately hosted application all required access. It does not establish that every possible deployment arrangement is impossible. A self-hosted same-origin client is a separate topology, and an agent REST response cannot substitute for native Bot Mode operation.

## Contract and historical decision record

1. An operator can authorize the exact external web origin without wildcard access or disabling authentication, host, or origin guards.
2. A public browser client can obtain appropriately scoped, short-lived authorization through a documented flow. It must not depend on a native loopback listener, a vendor-held master credential, or copying internal process credentials.
3. Native managed roster, canonical session, room and routine methods are available through that authorization. The server owns profile scope and actor identity; a client cannot impersonate another bot or approval principal through payload fields.
4. Streaming/WS authentication works with browser APIs using short-lived tickets where appropriate. Credentials must not be placed in long-lived URLs, logs, or application routes.
5. Native teammate delivery and group driving remain backend operations. Their execution continues independently of the observing browser where Hermes supports it.
6. Allowed and denied origins, expiry, revocation, reconnects, profile isolation, native delivery and routine ownership pass isolated real-Hermes and browser tests together.

## Routes requiring an explicit decision

Prefer an existing supported Hermes external-client interface or an upstream addition to that interface. If neither exists, a user-installed integration extension would require a scope decision: it must be recognized as additional backend functionality and cannot become an undisclosed mandatory helper. As of 14 October, the user authorized an optional integration plugin and the bot-web bridge has been implemented and tested in isolation. It has not been installed on a personal server. A same-origin self-hosted first release is also a scope decision, not completion of the hosted service requirement.

The vendor proxy/relay, weakened security guards and a generic chat fallback remain excluded. The foundation and isolated evidence can proceed without selecting any of these scope changes.
