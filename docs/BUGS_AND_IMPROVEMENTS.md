# Pebble Crew bugs and improvements

Track owner reports here through implementation, verification and release. A
published fix is separate from updating and verifying the owner's installation.
New reports receive a stable ID; later work updates the existing entry.

## Implemented in 0.5.0

| ID     | Report                                                                                             | Required result                                                                                                                                                                                                                                                                                                                    | Status                                                                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC-001 | A pebble removed or hidden by the orchestrator remains in the sidebar until the page is refreshed. | Reconcile the roster automatically after changes from the app, management tools or another Hermes process. Remove stale rows and pins, reconcile an affected selection safely, preserve unrelated drafts and recover missed changes after reconnect. The owner never needs to refresh manually.                                    | Implemented: shared snapshot/watch hints, five-second visible reconciliation, coalesced immediate mutation refresh, selection/draft recovery. Owner host update not performed.                                                            |
| PC-002 | The orchestrator needs to delete an agent, separately from hiding it.                              | Expose a real native deletion proposal through the management tool and owner review. Identify the exact existing profile and explain the native data consequences. Hiding must preserve the profile; deletion must use supported native deletion rather than just removing sidebar metadata. Both update the roster automatically. | Implemented: native lifecycle adapter, exact owner approval/typed name, incarnation guards and durable outcomes. Live crew membership is blocked until the crew is retired in Hermes.                                                     |
| PC-003 | The main interface needs the hierarchy and polish of the supplied dark Grok Bot reference.         | Larger pinned pebbles, compact sectioned rows with role chips and truthful previews, crew avatar stacks, readable conversation bubbles and time grouping, a compact expanding composer, and selected-agent details. Preserve real native chat, approvals, Stop, reconnect, drafts and avatar performance.                          | Implemented: production rail, transcript, inspector, drawers and shared tokens. Pins/order, native previews, scoped read cursors, routine controls, drafts and reading position. See the [implementation record](PEBBLE_CREW_UI_PLAN.md). |
| PC-007 | Hiding a pebble needs a clear, reversible operation that the app honors.                           | Support native hidden metadata, Show hidden and Unhide without changing personality, history, tools, routines or crew membership. Distinguish Hide from disabling Bot Mode and deleting the native profile.                                                                                                                        | Implemented: native hidden metadata, Show hidden, Unhide and owner-reviewed model proposals; native profile/personality/history remain intact.                                                                                            |

PC-001 verification must cover an unselected and selected pebble, a pinned
pebble, an externally initiated change, a missed event during disconnect, and
changes on a second browser. An action completed by the app or its management
tool should reconcile immediately after confirmation. The target for external changes is six seconds on a visible healthy client,
with an authoritative refresh after reconnect. Do not repeatedly query model
access to refresh the roster.

PC-002 must distinguish hiding, disabling Bot Mode and deleting the native
profile. A model cannot approve its own destructive proposal. Target identity,
owner approval, active work, orchestration/reporting links, native room
membership, canonical history and profile assets need explicit handling before
the operation is offered. Uncertain results require reconciliation; do not
automatically replay deletion. No owner's agents have been deleted by this work.

## Earlier implemented reports

| ID     | Report                                                                                                                | Implementation                                                                                                                                                                           | Deployment status                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| PC-004 | “Set up your agent” does not say whether the agent is existing or new, or which agent it is.                          | 0.4.2 source displays the detected native name, such as “Customize Aurora,” and explicitly identifies the existing primary Hermes agent. The form edits its handle and avatar.           | Published in 0.4.2 and verified locally; the owner's running installation has not been upgraded by this work. |
| PC-005 | Product naming was undecided and placeholder branding was used.                                                       | The owner chose Pebble Crew and pebblecrew.com. Repository renamed to enterkey-io/pebble-crew; maintained branding and links updated. Existing repository/setup/download links verified. | Repository rename complete; app branding is part of 0.4.2.                                                    |
| PC-006 | Excess setup text and oversized textual shape/color controls; the primary avatar could open as a static native image. | Published 0.4.1 uses concise forms, an animated iris default, shape thumbnails, color swatches, a matching preview and a neutral photo-upload state.                                     | Published and tested locally; updating an owner's installed copy remains an installer action.                 |

The 0.5.0 release is a development preview. No remote owner installation has been
updated by this work. Local evidence is recorded in
[the 0.5.0 verification report](compatibility/preview-0.5.0-local.json).
