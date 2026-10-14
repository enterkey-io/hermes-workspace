# Launch requirement: one agent completes setup

The owner gives one setup request to their own installation agent, which may access their chosen web host and Hermes. That agent completes installation, native Bot Mode readiness, connection configuration, verification and service lifecycle setup, then returns a usable app URL. The owner opens it and performs a normal owner-controlled connection approval. Developer intervention and relaying diagnostic messages between agents are not acceptable launch steps.

This is a release requirement, not a description of the current preview. The preview's manual address/code exchanges, repeated pairing after refresh, diagnostic repair guides and tracked background processes are not a launch-ready onboarding system. The recent owner test exposed missing automated installation coverage, even though individual protocol tests passed.

## What the installation agent must complete

- Discover the real Hermes home/profile, native compatibility, dependencies, existing listeners/routes and available supervisor before changing anything. Detect unsupported configurations early and explain the specific limitation within the same setup session.
- Deploy the static web app to the owner's chosen host, independently of Hermes, or reuse their existing app deployment. Install a versioned, verified integration only where required. Preserve existing configuration and unrelated services.
- Reuse native managed bots and canonical chats; when the owner's setup request authorizes it, create one starter bot and initialize its real Bot Chat using their existing model settings. Setup itself must not spend model tokens, send prompts or run tools through the bot.
- Configure the exact app origin, trusted HTTPS bridge and an appropriate owner-controlled route. Resolve port collisions and service errors locally. The owner should not need to select ports, copy private configuration, understand CORS, configure SSH or find an API key.
- Verify authentication, denial cases, actual roster, canonical readiness and at least 50 seconds of event frames. Close only its own diagnostic connections. Preserve other devices' grants and avoid spending model turns during install verification.
- Configure and verify recovery after process failure and the relevant supported host/container restarts. A background process is insufficient for a permanent installation. Install repeated runs and updates safely, preserving canonical state and avoiding duplicate bots, sessions, bridges or tunnels.
- Keep a private local version/deployment receipt with update, rollback and recovery information. Handle supported updates and recoverable installation errors within the same agent session, without requiring the owner to consult a development agent.

For self-hosted deployments, supply the connection configuration as part of that owner's deployment, so the returned app URL leads into the intended connection without asking the owner to re-enter server settings. Keep endpoints and user state out of vendor/shared deployment configuration. The corresponding discovery and approval design for shared hosting must be verified separately; it must not introduce a vendor credential vault or content relay.

## Owner experience and security

The owner may choose a hosting account/domain, authorize necessary account access, and approve their device. These are normal ownership decisions. Routine installation repair, compatibility investigation and server configuration are the agent's responsibility. A private route can require the owner's device to join their chosen VPN; that requirement must be clear before the owner starts, and browser permissions must be handled in context.

Normal reopening, refresh and recoverable network loss must not require contacting an agent again. The preview's memory-only, one-hour grants do not yet satisfy this requirement. Define and test owner-controlled device enrollment/reconnect before changing authentication: preserve revocation and scoped grants, never deliver an operator credential to the browser, and never persist private state on vendor systems. Any persistent device credential must be an explicit owner-device choice with an appropriate security design; this document does not implement or silently authorize a storage change.

If installation cannot complete within supported conditions, the same agent must diagnose or report the concrete blocker. It must not label a partial setup ready, repeatedly ask the owner to relay developer messages, weaken security, make unapproved purchases or patch Hermes core. No software can guarantee every arbitrary deployment works; launch support must be based on tested, documented environments with a complete supported path.

## Required acceptance evidence

Release acceptance must exercise the installed artifacts and agent procedure from a clean supported Hermes environment with **zero managed bots**, not only seeded fixtures or a preconfigured developer machine. Use synthetic state and a deterministic local model for any chat acceptance; never require personal credentials/content or real model spend.

Required gates are tracked in `docs/compatibility/installation-evidence.json`:

- One installation agent completes the supported procedure without development-agent intervention or owner-relayed diagnostics.
- Native bot and canonical chat initialization work from an empty supported home; existing-install repetition reuses identities and preserves history/configuration.
- Web and Hermes run on independent hosts with trusted TLS, and the owner's browser reaches the intended authenticated connection through the documented supported topology.
- The owner opens the returned URL, performs the intended approval, sees a usable bot and completes a synthetic native Bot Mode turn without entering server configuration.
- Refresh, reopening and recoverable network interruption work without renewed agent involvement while preserving authorization and revocation rules.
- Bridge, route and persistent configuration recover after supported process/host/container restart scenarios.
- Installed updates and rollback preserve state; interrupted installs resume safely without duplicates or unrelated service changes.
- Static/vendor infrastructure receives no user content, credentials or private endpoint configuration; diagnostic cleanup preserves other devices' access.

Existing native/bootstrap/browser tests contribute evidence, but do not independently pass this complete launch workflow. The production compatibility gate must stay closed until both the Bot Mode feature contract and these installation gates pass. Publishing a clearly marked development preview is not launch certification.
