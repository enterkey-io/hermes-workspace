# Use existing Hermes agents in Bot Mode

> **Version scope: legacy 0.2.x API-only installs.** For 0.4.x combined-plugin
> installation or updates, follow [AGENT_INSTALL.md](AGENT_INSTALL.md). The owner
> creates a login and confirms their existing primary agent in the app. Do not
> create a starter bot or register a primary agent on the owner's behalf. The
> procedures below are legacy reference and explicit operator repair only.

The product connects to the owner's existing agents. Installing it must not invent a neutral placeholder, clone an agent or require a SOUL transfer. Discover all native profiles, including ordinary profiles not yet registered in Bot Mode. The earlier automatic starter-bot instructions are superseded.

## Owner selection in the web app

After pairing, choose **Add existing agents**. The integration lists existing profile names/descriptions, including unmarked agents; it does not send SOUL contents, provider credentials or filesystem paths to the browser. Select the agents you want and choose **Add selected agents**. The app registers those same profiles in native Bot Mode and initializes or reuses their canonical Bot Chats, without a model prompt. Already-added agents are identified in the list. A lost/uncertain response requires an explicit refresh before another attempt; no mutation is automatically retried.

An older integration keeps its existing chats working and shows an update instruction for selection. Use bot-web 0.2.4 from the versioned release; keep existing private configuration, ports and routes. No Hermes Desktop installation or second agent is needed to choose profiles once that integration is installed.

## What identity preservation means

SOUL is loaded by Hermes from the **selected profile's own home**. Memory, skills, model/provider settings and channel configuration remain on that same profile. The adapter does not read/copy/rewrite those files to manufacture a replacement agent. Registering an existing agent changes only the absent Hermes managed-bot metadata namespace, using native compare-and-swap, plus native Bot Chat initialization if needed. It preserves other metadata namespaces. Native Hermes may maintain its own runtime credential caches and first-turn onboarding flags, as it does in its own interfaces; that is separate from application enrollment.

Bot Mode's canonical Bot Chat is a distinct conversation. Reuse an existing canonical chat and its compression lineage. Other Telegram/CLI/channel conversations remain in Hermes; they are not automatically merged into the Bot Chat. Same agent identity and profile memory do not mean every conversation has identical context. Explain that in the interface rather than promising an identity migration or universal history merge.

## Installing agent responsibilities

1. Verify the actual Hermes home/profile and compatibility. Query native `profiles.list` with `include_sessions: true`; zero managed markers is not an empty agent roster. Do not interpret a lookup error as absence.
2. Let the owner select profiles in **Add existing agents**, or ask which existing agents to enable if preparing enrollment before the browser handoff. If they explicitly ask for all, use their real existing profiles. Never select a new placeholder because they did not give a persona name. A new profile is a separate explicit choice.
3. The bridge's `agents.list` is read-only discovery. Its `agent.enable` accepts only an existing `profile` identifier and `initialize_chat: true`; it does not accept SOUL, credentials, model settings, arbitrary paths or raw RPC methods. The authenticated owner chooses the mutation. The app never calls `profiles.create` as enrollment.
4. Native enrollment confirms the profile and exact-title Bot Chat lookup first. If marking is needed, use `profiles.configure` with only that profile name, the absent `ui_meta["hermes-bots"]` namespace and its native expected revision. Preserve existing metadata and stop on a conflict rather than overwriting another client. Do not append a second teammate protocol to SOUL.
5. Reuse canonical chats. For a confirmed missing first chat, use native `session.create` with the same profile, `title: "Bot Chat"`, `hidden: true`, `follow_profile_config: true`, then native `session.title` to materialize the canonical identity without a prompt. Serialize local enrollment, recheck before creating, and adopt another native writer's canonical winner on a title conflict. Never force a rename or start a model prompt to recover.
6. Exact native lookup hides deliberately retired chats. The integration uses a read-only existing-database guard to refuse replacement when a stored Bot Chat exists but native lookup cannot confirm an active one. Errors/locks fail closed. No direct database writes are performed; retired chat decisions remain with the owner in Hermes.
7. Confirm the same profile is managed and has a canonical chat. Repeated enrollment must reuse it. Verify identity/configuration preservation in isolated tests and an actual native turn using the profile's SOUL; neither a displayed name nor an inherited model alone proves identity.

For a truly new Hermes installation, verify the owner's existing default profile before concluding there are no agents. If no usable existing profile exists, explain that prerequisite and obtain an explicit new-agent choice. Leave any previously created placeholder intact unless the owner separately directs removal or editing. Do not rename a placeholder or rewrite its SOUL to impersonate an existing agent.

Native source references at the tested af0cd4df build: [profile handlers](https://github.com/enterkey-io/hermes-agent/blob/af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a/tui_gateway/methods_profiles.py), [canonical session operations](https://github.com/enterkey-io/hermes-agent/blob/af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a/tui_gateway/methods_session.py), and [profile-specific SOUL loading](https://github.com/enterkey-io/hermes-agent/blob/af0cd4df34c73e41bcfcfa46c4081d1d83bdc81a/agent/prompt_builder.py). Compatibility remains tied to tested source bundles rather than host brands or version labels.

## Finish the connection test

Verify the authenticated event stream as well as the lists: `/v1/events` must return 200 with `application/x-ndjson`, emit `bridge.ready` immediately, and then keep sending heartbeat frames at roughly 15-second intervals. Use the exact allowed app Origin, an authorized credential in the Authorization header, and the connection lease in X-Bot-Connection. Compare the container loopback path with the real HTTPS URL if streaming fails. Inspect only status, media type and control frames for this diagnosis; keep credentials and bot content out of reports. A successful preflight or pairing request does not prove streaming works. Preserve TLS trust and origin/Host checks; do not move credentials into URLs or weaken authentication to troubleshoot.

Watch for at least 50 seconds, including when no bot session is open. A 200 response followed by an open but silent socket is a failed liveness check: the web client times out after 35 seconds without data. Plugin 0.2.1 could starve heartbeats when unrelated native events kept its queue busy but were filtered out of the browser's session scope. Plugin 0.2.3 schedules heartbeats independently of those events. Missing heartbeats on both loopback and HTTPS must be investigated on the bridge/runtime side before blaming the tunnel or an earlier outage. Do not disable the browser's idle deadline or relax session filtering to hide the problem.

## Clean up probes without disconnecting the owner

Keep each diagnostic probe's connection lease private. In a `finally` block, close its stream/HTTP reader and send authenticated **DELETE `/v1/connect`** using that probe's own X-Bot-Connection, Origin and credential. An operator probe must close its own operator lease. This frees a slot without revoking unrelated browser grants; retain their TLS/Host/origin protections. If a probe failed before obtaining a lease, close its transport only. Avoid parallel unnecessary probes that exhaust the eight-connection limit.

**Do not use `hermes bot-web revoke` or POST `/v1/pairing/revoke` as probe cleanup.** They invalidate all browser grants and leases, even if `--app-origin` is supplied. Use global revocation only for an owner-requested all-device sign-out or access response. If it was run accidentally, tell the owner that their grant was invalidated and that fresh pairing is required; a browser error afterward does not prove a broken tunnel. If unknown stale probes fill all slots, stop and report that specific issue instead of silently clearing the owner's access.

Once the owner pairs, they can select **Refresh bots** after agent-side setup; another installation is not necessary. Report infrastructure checks, Bot Mode readiness, owner browser pairing/roster, live stream and restart durability separately. Do not send model prompts or execute tools just to initialize or verify setup.
