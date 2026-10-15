# Hermes plugin hosting feasibility

Research date: October 15, 2026.

**A plugin can deliver a web interface from the owner's Hermes installation without
patching Hermes. A single address, owner login and automatic connection are also
technically feasible with the app we already have.** The remaining risk is making
installation, networking, updates and restart recovery dependable across supported
hosts. Changing the packaging alone will not resolve that risk.

Proceed with a limited installation pilot before migrating the running app. Keep
independent hosting available. Olares has no special role in the architecture.

## The experience to deliver

The owner tells their Hermes agent to install the package from GitHub. That agent
checks the host, installs a verified release, configures persistent services and
access, and returns one private setup link. The owner creates their admin login,
confirms their existing primary agent's handle and appearance, and enters its
native Bot Chat. Their existing personality, memory and settings remain in Hermes.

There is no address form, bridge token or pairing conversation in this flow.
Internal services may still authenticate to each other; the installer handles
that. Ordinary reloads, idle time and service restarts recover automatically. A
revoked or expired login can legitimately require signing in again, without asking
an agent to approve another connection.

The package must not require our infrastructure after installation. Owner accounts,
keys and configuration stay on owner-controlled storage. Bot conversations,
personality, memories and avatar photos stay on Hermes. The owner's configured
model and connected services still receive the data needed for their jobs;
self-hosting the interface does not make a cloud model local.

## The three approaches

| Approach                        | What runs                                                                                              | Advantages                                                                                                                    | Main costs                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dashboard extension             | Prebuilt UI and Python API inside the existing Hermes dashboard                                        | Reuses its port, authentication and supervised process when those already exist; prebuilt browser assets need no Node runtime | Adapts to the dashboard shell and auth flow; shares its broad trust boundary; live streaming has an isolation-mode constraint |
| Plugin with its own web service | One installable plugin package starts the existing owner app and native integration behind one address | Preserves our UI, first-use admin login and narrow API; reuses most current code                                              | Still needs Node plus Python, a service supervisor and configured routing; one install does not mean one process              |
| Independently hosted app        | Owner app elsewhere, integration beside Hermes                                                         | Preserves deployment on an owner's web host and the original remote-client architecture                                       | Installer must establish trust and a reachable Hermes route between two hosts                                                 |

All three can retain actual native Bot Mode. None requires a vendor relay. For the
first pilot, prefer packaging the existing app and integration together behind
one address. This tests the difficult installation work while preserving the
working UI and owner authentication. Keep the dashboard extension as an option
if it can meet the same UI and security requirements with less operational work.

## What Hermes already provides

Hermes documents dashboard plugins with prebuilt JavaScript, optional CSS, a
manifest and Python API routes. Those routes live under
`/api/plugins/<plugin-name>/`. These are extension points, so a fork or edit to
the dashboard source is unnecessary. A plugin tab can replace a built-in page;
it does not, by itself, replace the surrounding dashboard shell.
[Dashboard extension reference](https://hermes-agent.nousresearch.com/docs/user-guide/features/extending-the-dashboard).

Source inspection and disposable runtime probes cover these exact builds:

| Reported Hermes version | Source revision                            | Probe Python |
| ----------------------- | ------------------------------------------ | ------------ |
| 0.21.0                  | `29112bef099274229cadff79cdff7bf7b99c4b77` | 3.12.14      |
| 0.21.7                  | `af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a` | 3.14.7       |

Both mounted a disposable plugin through the native loader. Its pages and API
inherited the native authenticated session. Three test stream frames reached
the ASGI response boundary about 200 milliseconds apart, without waiting for the
response to finish. Router startup and cleanup also ran on both tested Python
environments. These checks validate the backend extension mechanism, not a
finished rendering of our app inside Hermes's dashboard.

The newer build also supports `plugins.isolation: host`. Its dashboard API
forwarder explicitly buffers responses; its source says streaming and WebSockets
need the in-process path. An endless event stream cannot use that buffered
forwarder. Do not silently change an owner's isolation setting. A dedicated
companion service avoids depending on that dashboard forwarding path; the other
parts of our integration still need their own isolation compatibility audit.

The existing Bot Mode adapter continues to use native profile, canonical chat,
room and approval operations. Moving the web files beside Hermes does not turn
those operations into a stable public API. Our compatibility checks and validation
of new Hermes releases remain necessary.

## Authentication needs a deliberate choice

The native dashboard can use password or OAuth providers. Its documented password
provider is intended for a trusted network or VPN; Hermes recommends an OAuth
provider for direct internet exposure. Reusing that provider must not quietly
reduce the security requirements of our internet-facing app.
[Dashboard authentication guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard).

The probes confirmed that a configured public hostname engages authentication
even when the backend binds to loopback. The native password session survived
reconstructing its provider with the same signing key, and failed with a changed
key. Its signing key therefore needs persistent storage. The provider's logout
implementation does not revoke individual stateless tokens server-side. That is
a difference from our existing database sessions and session-revocation controls.
[Pinned password-provider source](https://raw.githubusercontent.com/NousResearch/hermes-agent/29112bef099274229cadff79cdff7bf7b99c4b77/plugins/dashboard_auth/basic/__init__.py).

Our current Better Auth owner service already implements the requested first-use
admin account, database sessions and local configuration. Retaining it in the
combined package avoids inventing another password system. It does require a
Node runtime. Embedding the app in the native dashboard would need an explicit
auth adapter or an agreed change to the first-use flow; it is not a file-copy job.

The native probe's authenticated synthetic POST accepted a forged Origin header.
This is not a browser CSRF exploit demonstration: browsers constrain cookies and
cross-origin requests. It does establish that our own exact-Origin mutation
checks should be retained rather than assuming CORS supplies that check.

The first visitor to an exposed installation must not be able to claim its admin
account. The installer should provide a short-lived, single-use setup link or use
an already verified owner session. A setup-link secret should stay out of query
strings and server logs. Automatic consumption of such a private link is still
pilot work; the current owner interface uses an explicit setup proof field.

## Installation and updates are the largest remaining work

Hermes supports Git-backed plugin installation, subdirectories and explicit
revision pins. Owners do not need to fork our repository. A pinned installation
must deliberately advance to another verified revision; a plain plugin update
does not move it. Keep mutable state outside the replaceable plugin code.
[Plugin installation and updates](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins).

The current repository root is not an installable plugin manifest. Its integration
lives under `plugins/bot-web`, while the owner service and browser assets are
separate packages. We need an actual combined release layout and dependency
declarations before promising “install this plugin.” The newer Hermes dependency
reader recognizes a plugin's project dependencies or manifest declarations;
`requirements.txt` alone does not declare them to that reader.

A direct probe of the newer native installer found another important limitation:
in a headless install, its Python-dependency consent flag does not install Node
dependencies. A package with only `package.json` could pass that gate while its
Node dependencies were skipped. The combined installer must explicitly provision
and verify its runtime, then refuse to report success if that step fails.

Plugin background-task helpers manage tasks inside the current process. They are
not an operating-system or container restart policy. Never start a web daemon
as an import side effect of plugin registration: multiple agents, CLI commands
and reloads can discover the plugin. Start it through one idempotent setup path
and a supported service manager.

The update transaction needs to stage a verified release, validate Hermes
compatibility, back up mutable state, apply versioned migrations, restart only
owned services, check authenticated readiness and streaming, and restore the
previous release if activation fails. It must preserve login keys, native stores,
the primary agent, installed origins and unrelated routes. Updating code on disk
is not evidence that the running service adopted it.

## Host and network requirements

| Host situation                                   | Feasibility                                                     | Required installation authority                                                             |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Linux host with a writable Hermes home           | Good pilot target for the combined package                      | Install dependencies; create a user/system service and an HTTPS or private route            |
| Existing supervised Hermes dashboard             | Good target for a dashboard-extension pilot                     | Enable the plugin and arrange any needed restart, authentication and assets                 |
| Docker                                           | Feasible with persistent configuration                          | Change the deployment's volumes, restart policy and published route as needed               |
| Kubernetes, including the current Olares install | Feasible with access to the deployment configuration            | Persist the package/state and configure supervision plus Service/Ingress or a private route |
| Hermes process with no host or deployment access | Local installation may work; a usable remote URL is conditional | Another authorized operator must supply routing or deployment access                        |
| App on a separate web host                       | Still feasible as the optional independent mode                 | Configure both hosts and their trust relationship                                           |

These container conclusions come from source and deployment-script inspection;
the research probes ran on macOS, not in Docker or Kubernetes. The existing
container dashboard service has a supervised slot, but enabling it and making
its port reachable are deployment choices. Installing files inside a running pod
cannot itself create Kubernetes permissions or persistent ingress configuration.

A plugin cannot eliminate remote networking. It can put UI and API behind the
same reachable endpoint and let the installer configure that endpoint. For a
tailnet-only install, Tailscale Serve provides private web access within the
tailnet; the owner's devices still need access to that tailnet.
[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).

The current Mac-to-pod tunnel is a development arrangement. A released installer
must use the owner's infrastructure and must not depend on our Mac, tailnet,
domains or accounts. Public HTTPS and any owner-selected tunnel need separate
topology acceptance; the local single-address test does not certify them.

## Research evidence and limits

The native dashboard probe runs seventeen acceptance checks on each supported
build, plus observations about lifecycle, Origin handling and dependency consent.
It uses a temporary Hermes home, generated synthetic credentials and no model.

The combined-host browser probe uses the existing compiled app, owner service and
native Bot Mode integration behind a disposable loopback HTTPS front door. A
deterministic local model supplies the test response. This evaluates composition
of existing services; it does not install them through Hermes's plugin manager.

Eleven browser checks passed on each build: first-use account creation, native
primary onboarding without a connection form, a real Bot Mode message and reply,
streaming past an accelerated idle lease, secure session cookies, preservation of
an unsent draft through a native gateway restart, and continued login after an
owner-service restart and reload. Browser requests used one origin and produced
no page errors. Complete integration-process restarts remain a pilot gate.

Results, exact source fingerprints and commands are in
[the evidence record](compatibility/plugin-hosting-research.json). Reproduction
fixtures are [the dashboard probe](../scripts/fixture/plugin_hosting_probe.py)
and [the combined-host browser probe](../scripts/fixture/combined_host_probe.mjs).
The browser fixture uses a disposable certificate exception, so it does not
validate public certificate provisioning. No running owner installation was
migrated, no production credential was used and no release was published.

## Pilot sequence and decision gates

1. **Produce one installable candidate.** Bundle prebuilt UI, native integration,
   owner auth and locked runtime dependencies at a verified GitHub revision. Add
   an idempotent preflight that identifies the actual Hermes home, supported
   build, writable storage, available ports, service manager and network route.
   It must name missing permissions before partially changing the host.
2. **Finish one-owner setup.** The installer creates internal trust automatically
   and returns one protected setup link. The owner creates an admin account,
   confirms the detected primary agent's handle and appearance, and reaches its
   real Bot Chat. Do not create a placeholder persona or require preexisting
   managed-bot registration.
3. **Prove supervised operation.** Start after host or container restart. Reconnect
   after sleeping devices and proxy interruptions, preserving unsent drafts and
   avoiding replayed sends. Exercise browser sessions across complete web and
   integration process restarts, not only a native gateway restart.
4. **Prove updates and rollback.** Upgrade an installed previous release; preserve
   sessions, profiles, memories, roles, photos and settings. Simulate dependency,
   migration and readiness failures. Verify rollback without downgrading Hermes
   or modifying unrelated services.
5. **Test independent installations.** Begin with a Linux service and a Docker
   deployment on the two supported Hermes builds. Then test Kubernetes with real
   deployment permissions, including the current owner's route. Verify TLS,
   Origin/Host restrictions, session revocation, approval boundaries, logging and
   exposure of only the intended APIs. Measure installed memory and startup cost.
6. **Choose the default after those results.** Adopt the combined plugin only if
   one installer agent can complete the supported path without a second agent
   or a manual pairing loop. Prefer native dashboard embedding only if it also
   preserves our full interface, first-use account and security requirements.
   Retain the independent hosting path through the same native integration and
   shared client protocol.

**Decision: proceed with a contained installation pilot; do not migrate the live
architecture yet.** The extension and single-address primitives are feasible.
Seamless installation, complete-process recovery, updates and owner-controlled
remote access are the acceptance gates for selecting the final default.
