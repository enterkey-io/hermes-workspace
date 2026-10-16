# Pebble Crew bugs and improvements

Track owner reports here through implementation, verification and release. A
published fix is separate from updating and verifying the owner's installation.
New reports receive a stable ID; later work updates the existing entry.

## UI foundation reset — latest 16 October reports

The owner rejected the 0.6.0 interface across its main routes. Reopen the visual
and interaction acceptance for PC-009, PC-010, PC-012–PC-015, PC-019, PC-021,
PC-022's composer interaction and PC-024. Their historical implementation notes
below are not current acceptance. The replacement has an isolated synthetic
reference and an independent Astra review; **production migration remains open**.
No issue is closed by the prototype.

| ID     | New report                                                                                          | Current work                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| PC-025 | Ordinary row overflow overlays name/title; pinned overflow overlays the face.                       | Dedicated row column and pin action strip in reference. R03/R04 production gates open.                                                    |
| PC-026 | Search breaks the rail header and only filters names. Must search system content in an overlay.     | Reference overlay stable. Owner-local history/file-content capability required; R05/R06 open.                                             |
| PC-027 | Sent messages enter abruptly and remount/reflow on acknowledgement.                                 | Stable render-key/delivery/scroll contracts and reference entry. Native reconciliation and delayed/error cases open; R07.                 |
| PC-028 | Timestamp appears seconds later and floats awkwardly inside bubble.                                 | Immediate reserved metadata lane in reference. Native confirmation/missing-time/anchor cases open; R08.                                   |
| PC-029 | Copy word clutters metadata; use a separately placed icon.                                          | Accessible icon in reference. Actual-route clipboard success/failure/touch review open; R09.                                              |
| PC-030 | Inconsistent rounded tabs, arbitrary divider lines and page controls lack a real shared foundation. | Actual shadcn/Radix, Tailwind, Lucide and Motion installed. Settings, editors and every real route still need migration; R01/R02/R11/R12. |

The full matrix, including avatars and coordinated panel motion, is
[UI_RESET_REVIEW_CHECKLIST.md](UI_RESET_REVIEW_CHECKLIST.md). The replacement
design and executable sequence are [UI_SYSTEM_RESET.md](UI_SYSTEM_RESET.md).

## Historical 16 October 2026 — implementation in the rejected 0.6.0 candidate

The owner authorized inline implementation after the Astra-high audit and plan.
The shared system now covers the production screens. Automated validation is
recorded in [the release evidence](compatibility/preview-0.6.0-local.json); the
owner's installed host still needs the combined-package update and review.

See the [UX audit](PEBBLE_CREW_UX_AUDIT.md),
[starter design system](PEBBLE_CREW_DESIGN_SYSTEM.md),
[implementation sequence](PEBBLE_CREW_UX_IMPLEMENTATION_PLAN.md), and
[native feature findings](PEBBLE_CREW_NATIVE_CAPABILITIES.md).
UX IDs map to the detailed evidence and acceptance criteria in those documents.

| ID     | UX ID | Report / required result                                                                                                                                          | Status                                                                                                                                                                  |
| ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC-008 | UX-01 | Empty/tool-only chat bubbles: project meaningful messages and expandable turn activity without losing real replies, files, approvals or native cursor scope.      | Implemented: lossless source rows, grouped tool activity, final sidecars; browser and unit coverage.                                                                    |
| PC-009 | UX-02 | Pinned menu leaves the viewport: accessible, collision-aware overlay at every rail/viewport edge.                                                                 | Implemented: portaled collision-aware menu, keyboard/Escape/focus and phone coverage.                                                                                   |
| PC-010 | UX-03 | Settings needs the same design system and scoped, understandable forms as chat.                                                                                   | Implemented: Account/Connections/Requests use shared forms, tabs, loading/error states.                                                                                 |
| PC-011 | UX-04 | Rename organizational Teams to Crews; create/manage from sidebar +, alongside New pebble. Preserve distinct native group chats and reporting relationships.       | Implemented: sidebar New crew and per-Crew editor; typed native Group chat creation stays separate.                                                                     |
| PC-012 | UX-05 | Redesign Add/Edit pebble; distinguish adding an existing native agent from creating a new one, preserve edits and make save outcomes clear.                       | Implemented: existing/fresh paths, reviewed native creation, scoped forms, draft/conflict/retired-identity protection.                                                  |
| PC-013 | UX-06 | Audit main-page usability/accessibility first, then establish tokens, components and states covering every app surface.                                           | Implemented: shared tokens, menu, tabs, form sections, notices, dialog/drawer and all screen migration.                                                                 |
| PC-014 | UX-07 | Keep three-dot triggers transparent with no hover background; provide readable glyph/focus feedback and reliable touch discovery.                                 | Implemented: transparent always-discoverable overflow triggers; glyph/focus feedback without hover fill.                                                                |
| PC-015 | UX-08 | Pin responds promptly, indicates pending/confirmed state honestly, and animates the same identity into/out of the shelf with reconciliation and rollback.         | Implemented: immediate pending pin intent, identity-preserving animation, authoritative commit or rollback.                                                             |
| PC-016 | UX-09 | Center pinned pebbles, including incomplete rows, without changing saved order.                                                                                   | Implemented: centered incomplete pin rows, stable saved order.                                                                                                          |
| PC-017 | UX-10 | Show genuine role/title beside ordinary sidebar names; preserve readable long titles and missing-data behavior.                                                   | Implemented: actual role chip, truncated long labels, no invented role for missing data.                                                                                |
| PC-018 | UX-11 | Use Main Pebble throughout user-facing and model-facing prose; preserve compatible internal IDs and actual permissions.                                           | Implemented: Main Pebble in product/model prose; compatible persisted identifiers retained.                                                                             |
| PC-019 | UX-12 | Toggle/close details at every size with a sliders icon, attached avatar star, no idle Ready text, and Routines/Files/Computer tabs backed by actual capabilities. | Implemented: optional details, attached star, Routines/Files tabs; Computer native transport probe passed; viewer disabled by default pending Linux desktop acceptance. |
| PC-020 | UX-13 | Replace exposed footer actions with the owner's avatar menu for Settings, Show hidden and Sign out.                                                               | Implemented: owner avatar menu contains Settings, Show hidden, Sign out.                                                                                                |
| PC-021 | UX-14 | Cohesive motion: fast visible Latest messages scroll, gentle hover/panel/selection/reorder transitions, cancellable and reduced-motion equivalents.               | Implemented: 240 ms Latest motion, cancellation, hover/panel/reorder feedback and reduced motion.                                                                       |
| PC-022 | UX-15 | Correct composer cursor/focus behavior and add real file pick/paste/drop, upload, send and history/Files support on owner infrastructure.                         | Implemented: caret/focus, private pick/paste/drop, real native file send and Files download. Direct chats only; generated-output indexing deferred.                     |
| PC-023 | UX-16 | Complete keyboard, screen-reader, focus, target-size, contrast, zoom/reflow, async-state and small-screen acceptance across all flows.                            | Automated keyboard, contrast, focus, phone, reflow/resize, async and browser Back coverage passed. Manual assistive-technology/device review remains.                   |

Product terms are **Main Pebble** and **Crews**. Stable internal
`orchestrator`/`teams` fields remain compatible. Existing native identities,
canonical histories and reporting are preserved. A published candidate and an
owner-host update are separate checkpoints.

## Additional avatar feedback — 16 October 2026

| ID     | Report                                                                                                                                                                    | Status                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC-024 | Rest looking up/right, wake and follow the pointer over rows/details/settings, restore fluid eye/body motion from the demo, and avoid a permanent frozen completion pose. | Implemented in the shared app/lab renderer: seeded idle breathing/gaze, local eased hover/focus, one scheduler, visible-instance budgets, static reduced motion, completion → rest. Unit, app and dense-roster browser checks cover the change. |

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
