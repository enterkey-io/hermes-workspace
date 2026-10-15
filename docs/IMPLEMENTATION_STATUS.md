# Installed-owner implementation status

This file tracks the current development implementation separately from the last
published 0.2.4 preview. It is not a production certification or a claim that an
owner's remote Hermes has been upgraded.

Implemented and exercised locally:

- Maintained Better Auth username/password login; one administrator, one-use
  installation proof, atomic bootstrap, no public signup/reset, database sessions
  and rate limits, secure HttpOnly/SameSite cookies, no auth telemetry.
- Equivalent Node/SQLite and Cloudflare Worker/D1 owner services. App configuration,
  login and signing keys belong to the owner's app host. Chat never passes through
  that service. No vendor account, content database or relay.
- Operator-enrolled Ed25519 public-key trust on Hermes, five-minute browser tickets,
  authenticated lease renewal and independent stream expiry. Ordinary login can
  obtain new tickets after restart; pairing is disabled for an enrolled issuer.
- Native primary detection, owner confirmation of public handle and animated/photo
  appearance, canonical Bot Chat enrollment without a model call, optional real
  at-most-once welcome request. No placeholder agent or SOUL rewrite.
- Private Hermes-side identity/team/role/reporting store; stable IDs, retired handle
  reservation, one orchestrator, reporting-cycle rejection and native metadata CAS
  merge. Team section names are mirrored without replacing unrelated metadata.
- Real `workspace_agents` model tool, bundled `bot-web:manage-team` skill, native
  session-store caller binding and per-turn role/identity context. Exact proposals
  wait for owner review. No model self-approval or privilege changes.
- Native profile creation with distinct SOUL and credential/channel mirroring disabled.
  An exact approved grant selects only the primary API-key/custom model provider,
  never the whole .env or an authentication pool. Model setup and selected tools
  complete before canonical chat initialization. Synthetic new-agent model turns
  pass on both supported builds; unsupported model authorization stays partial.
- Installed toolset/skill selection with native empty-list safeguards; native
  connection catalog, API-key cards, native dashboard OAuth with fixed callback
  and PKCE, non-destructive tests and explicit per-MCP-tool permissions. Real
  loopback MCP/authorization fixtures pass on both supported builds. Saved changes
  do not claim runtime readiness merely from configuration.
- Shared low-cost avatar renderer in onboarding, Settings and roster; white palette,
  local photo preparation, independent server raster decoding/re-encoding and native
  profile asset storage. Photos never go to the owner-login service or vendor.

Still required before the full plan is complete:

- OAuth/credential-pool model grants, resumable repair of partially created agents
  beyond an explicit model-access repair, and bounded standing management grants.
- Runtime activation proof and credential replacement/rollback tests for connections,
  plus native setup of service packages absent from Hermes. Catalog entries do not
  promise installation of arbitrary commands or vendor account services.
- Task dependency/result coordination beyond native messaging and role context;
  the broader public-handle restart matrix and active-job behavior. Native DM
  and local room handoffs with changed handles pass on both supported builds.
- Complete installation/migration/update/supervision acceptance on independently
  hosted owner infrastructure. The developer's old static preview is not evidence
  of a finished owner installation.

The earlier plans remain the requirements. Implemented subsets above do not waive
remaining exit gates. Local fixture results use only disposable homes and a mock
model; they do not establish behavior of an owner's actual model or services.

Local owner-browser acceptance additionally verifies secure session cookies, idle
heartbeats beyond an accelerated lease, ticket renewal, offline recovery and a real
native gateway restart with an unsent draft and zero replayed sends, photo/shape
switching with saved-photo reuse, team/role edits, password change and ordinary
logout/login. Local Workerd/D1 verifies the same auth library and restart persistence.
The owner package installs and starts separately from the development checkout.
These results are development evidence, not an installed-owner launch pass.

Machine-readable local evidence: [owner-instance-local.json](compatibility/owner-instance-local.json).
