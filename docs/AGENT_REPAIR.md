# Repair an existing preview connection and finish Bot Mode setup

For the owner's existing Hermes agent. Use this when an older preview hides existing ordinary agents, shows only a placeholder, has no bots, or loses live updates. Keep the independently hosted web app where it is. No Hermes Desktop installation, Hermes downgrade, core patch or new hosting account is required.

## 1. Preserve the working connection arrangement

Inspect the actual runtime/home, current plugin path/version and existing supervisor, private configuration and forwarding arrangement locally. Keep the configured bridge port, exact web origin, allowed HTTPS Host and route. The configured port may intentionally differ from the default because another service occupies it. Do not stop unrelated services, relocate the web app, recreate a tunnel, rerun setup or print private configuration/credentials.

## 2. Update only the integration code

Use [v0.2.4-preview.1](https://github.com/enterkey-io/hermes-workspace/releases/tag/v0.2.4-preview.1): native plugin version **0.2.4**, protocol `hermes-bot-web.v1`. Download its plugin archive, manifest and SHA256SUMS over trusted HTTPS and verify size/digest and archive safety as described in the [installation guide](https://raw.githubusercontent.com/enterkey-io/hermes-workspace/main/docs/AGENT_INSTALL.md). Do not execute moving-branch code or mix artifacts from different tags.

When idle, stop only the bridge using its existing process/supervisor mechanism. Keep a private backup of its previous plugin code for rollback, replace `<actual HERMES_HOME>/plugins/bot-web` with the verified new plugin, and leave `<actual HERMES_HOME>/bot-web/connection.json` and Hermes stores untouched. Run `hermes bot-web doctor` in the existing runtime/home and confirm support. Relaunch the bridge with the same environment, configuration and local port. Confirm an authenticated `/v1/connect` reports `bridge_version: "0.2.4"`; replaced files or a healthy Hermes doctor alone do not prove the new bridge process is serving. Clean up this probe's lease as described below. Preserve the web app and existing HTTPS/SSH routes. A restart clears in-memory browser grants; fresh pairing is expected. Follow the [update/rollback procedure](https://github.com/enterkey-io/hermes-workspace/blob/main/docs/UPDATES.md).

Version 0.2.3 fixes a heartbeat scheduler that could stay silent when unrelated native events continuously reached the queue but were filtered out of a browser's session scope. The fix preserves that filtering and uses a fixed heartbeat deadline. An open socket without heartbeat frames is not a passing stream check.

## 3. Finish native Bot Mode setup

Discover all existing profiles in the same Hermes home used by the bridge, including unmarked ordinary agents. Do not interpret zero managed bots as an empty agent roster. Use [existing-agent setup](https://raw.githubusercontent.com/enterkey-io/hermes-workspace/main/docs/BOT_MODE_SETUP.md). The owner can choose profiles in **Add existing agents** in the app; if preparing them locally first, ask which existing profiles they want. Registration uses those same profiles and their native Bot Chats; no SOUL/persona transfer or clone is needed. Preserve their memories, skills, model/provider settings and channel configuration. Initialize the selected agents' native Bot Chats without a model prompt.

The previous automatic starter-bot recommendation is superseded. Do not create another placeholder or turn an existing placeholder into an imitation of a real agent. Leave existing profiles, including any prior placeholder, intact unless the owner separately directs a change. Creating a new agent is an explicit product action, not a connection test. No Desktop application is required.

## 4. Verify and clean up only your probes

Confirm the real configured HTTPS bridge and exact app Origin return the expected CORS/auth behavior. Using your own authenticated connection lease, observe `/v1/events` for **at least 50 seconds with no bot selected**. Expect 200, `application/x-ndjson`, immediate `bridge.ready` and heartbeat frames around 15, 30 and 45 seconds. Compare with loopback if anything differs. Keep credentials, lease identifiers, content and private endpoints out of reports. A local bridge returning the expected build does not alone prove owner-browser reachability.

In `finally`, close the stream/reader and DELETE `/v1/connect` with **your probe's own** Origin, Authorization and X-Bot-Connection. Do not run `hermes bot-web revoke` or POST `/v1/pairing/revoke` to clean up stale probes; they invalidate every browser's grant and lease. If capacity is exhausted by unknown connections, report that blocker instead of silently signing out the owner.

## 5. Return one clear handoff

Give the owner their existing web app URL and separate Hermes connection address, any required VPN access, the installed plugin version, managed/initialized bot counts, observed heartbeat timings and service restart limitations. Ask them to refresh the web app, choose **Connect my Hermes**, request a fresh five-minute code and send it to you for local approval. Approve that exact code and app origin; then verify the native roster in their browser without sending model prompts. Report owner-browser verification as pending until they perform it.

Background bridge/tunnel processes may still be temporary. Updating the plugin does not create permanent supervision. Preserve and report that limitation rather than claiming a gateway/pod restart will recover automatically.
