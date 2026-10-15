# Pebble Crew interface implementation plan

Rebuild the daily conversation interface around pebbles, crews and readable
messages. Preserve the installed plugin, local owner login, actual Hermes Bot
Mode, existing identities and the approved avatar renderer. This is the proposed
implementation sequence following the Astra high-effort review of the owner's
dark Grok Bot reference and the current rendered app on 15 October 2026.

Track individual reports in [the backlog](BUGS_AND_IMPROVEMENTS.md). The stale
sidebar and real agent deletion are separate work items with their own native
behavior and verification requirements.

## Reference anatomy and target layout

The reference is 1912 by 1121 image pixels. Its approximate measurements describe
the supplied image; the proposed CSS dimensions below account for smaller
browser windows. No private conversation content from the reference belongs in
fixtures, documentation or design services.

| Area                   | Reference                                                                                            | Pebble Crew target                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Left rail              | Approximately 460 pixels wide, compact search/add controls, spacious identity rows                   | About 340 CSS pixels at a 1440-pixel viewport, growing toward 400 on larger screens; one scrollable roster and a small fixed account footer |
| Pinned pebbles         | Selected tile about 120 by 144 pixels; avatars 68–74 pixels; name and small role label               | Approximately 100 by 124 CSS pixel tiles, 64–72 pixel avatars, clear selection and one truncated role line                                  |
| Ordinary rows          | Approximately 68–72 pixels high; avatars 42–46 pixels; name, role chip and preview                   | 60–68 pixel rows, 40–44 pixel avatars, 15-pixel names and 12–13 pixel secondary text                                                        |
| Signifiers             | Approximately 20-pixel star badge on the orchestrator; compact role chips                            | Separate size tokens for avatar, orchestrator badge, role chip and activity/unread indicator; pinning never implies orchestration           |
| Crew row               | Partially visible stacked miniatures and an overflow count, followed by a preview                    | A 40–44 pixel group mark with two or three 22–26 pixel member avatars and a count; resolve members from native identity                     |
| Conversation           | Black canvas, bounded incoming bubbles around 700 pixels wide, narrow outgoing bubbles aligned right | Compact 48–56 pixel header; 680–740 pixel maximum reading width; 15–16 pixel body text with 1.5–1.6 line height                             |
| Time and reply context | Centered time separators; one-line reply excerpt above an outgoing message                           | Group time separators using actual native timestamps; show reply relations only when their identity and semantics are supported             |
| Composer               | Approximately 56 pixels at rest with inline actions                                                  | 48–56 pixels at rest; expands to about 160, then scrolls internally; send/stop remains reachable                                            |
| Details panel          | Approximately 392 pixels wide; avatar, name, role and grouped routine rows                           | 300–340 CSS pixels; selected pebble or crew identity first, then actionable context and compact routine rows                                |

The crew row is cropped in the reference. Its menus, selection behavior and
membership controls are not established by that image. The image also does not
establish mobile behavior or the implementation of voice, attachments, Library
or Computer.

Use the visual hierarchy and interaction density as the reference. Continue
using original Pebble Crew shape geometry, motion and styling.

## Current implementation gaps

- `apps/web/src/App.tsx` combines connection management, roster selection,
  history, activity, approvals, chat rendering and the three-column shell.
  Its roughly 1100 lines make consistent behavior and focused UI work difficult.
- The 250-pixel rail gives prominent space to management buttons. It has no
  pinned shelf, recent-message summaries or unread state. Rows repeat handles
  and descriptions rather than prioritizing names, roles and conversations.
- The local message model retains role and text while dropping durable IDs,
  timestamps and author metadata. Room text is flattened into a generic
  assistant message labeled with the crew title.
- The conversation header, explanatory subtitle, composer help and footer use
  space needed for the conversation. The textarea is large before typing.
- The inspector begins with activity rather than the selected identity.
  Its narrow layout becomes an inline disclosure above the composer on smaller
  screens, which can crowd out the chat when an approval is open.
- Roster refresh happens on connection and explicit UI callbacks, not after
  changes made by management tools or another Hermes process. The event bridge
  forwards session-scoped traffic but has no roster invalidation contract.
- The bridge exposes routine listing, but no enabled-state mutation. It has no
  typed Hide or Delete management action.

Keep the corrected first-use semantics: the owner customizes the explicitly
identified existing primary Hermes agent. This flow does not create a new agent.

## Shared visual system and components

Create a small token file for surfaces, borders, text hierarchy, focus, attention,
spacing, radii, typography, avatar variants and panel widths. Use system fonts
and a small local SVG icon inventory. Add reusable accessible icon buttons,
menus, fields and drawers; no new UI framework is required for this work.

Extract the production components rather than building a separate showcase:

- `WorkspaceShell`, `WorkspaceRail`, `PinnedPebbles`, `PebbleRow`, `CrewRow` and
  `AvatarStack`.
- `ConversationHeader`, `Transcript`, `MessageBubble`, `TimeDivider`,
  `ReplyReference` and `Composer`.
- `ContextPanel`, `PebbleDetails`, `CrewDetails`, `RoutineList` and
  `ApprovalCard`.

Retain `MessageBody.tsx` and its safe Markdown handling. Replace the avatar's
single `large` switch with explicit row, pin and details sizes while preserving
the shared scheduler, reduced-motion support and photo rendering. Badge sizes
must remain legible independently of the body geometry. Give orchestration,
activity and unread state distinct meanings and placement.

Use “Pebbles,” “Crews,” “Add pebble,” “Details” and “Routines” in the product.
Keep native operation names and installation terminology out of daily chat.
Sidebar sections organize pebbles; crews are native group conversations.
The existing `teams` representation must not be relabeled as shared chats.

## Data contracts and state ownership

Preserve native-facing contracts and validators in `packages/hermes-client`.
Put pure identity, activity and timeline reducers in `packages/core`; keep
presentation selectors and component state in the web app. Continue using a
narrow bridge allowlist and owner-scoped authorization.

| Contract                 | Required fields and behavior                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pebble summary           | Stable identity and native incarnation binding, profile, name, handle, role, appearance, section, pin state, canonical availability, activity freshness and optional preview/unread state |
| Crew summary             | Installation authority, native room ID, revision, verified members, latest sequence and optional preview/read state                                                                       |
| Transcript item          | Stable conversation/message identity, content kind, author, text, optional timestamp/reply identity and delivery state                                                                    |
| Conversation state       | Authoritative history, streaming turn, approvals, freshness, send state, draft, scroll anchor and last-read cursor                                                                        |
| Routine summary          | Owning profile, native job ID, title, schedule, enabled state, pending mutation and confirmed error/result                                                                                |
| Presentation preferences | Versioned pin order, section presentation, read cursors and device-specific panel preferences                                                                                             |

The inspected af0 native source exposes transcript timestamps and durable row
IDs, room event IDs/sequences/actors/times, and room membership. Preserve these
through adapters instead of reconstructing them in the browser. Confirm parity
on 29112 before advertising the same capability there. Missing dates stay
missing; browser arrival time is not a substitute for a historical timestamp.

Native profile metadata already contains pin/section information. Reuse the
native pin value through whole-namespace compare-and-swap updates, preserving
unrelated metadata. Store ordering and other presentation preferences privately
on the owner's Hermes installation. Define one authority for each preference;
an unpin must survive restarts and default initialization.

Store preferences and read cursors under stable installation/agent/crew
identities using optional versioned records and tested rollback behavior. Do not
put transcript bodies in the owner authentication database. Pins/order and read
state can follow the owner across devices; panel visibility/width can remain
device-specific.

Read cursors must be monotonic within a verified conversation incarnation and
its native ordering. A stale second device cannot move the cursor backward or
mark already-read activity unread. Replaced canonical chats and recreated rooms
need distinct cursor scope rather than inheriting an unrelated sequence.

Obtain sidebar summaries with a bounded native read. Never open or resume all
agents merely to populate previews. Use a role/description fallback until actual
conversation summaries are supported. Begin with a truthful unread indicator;
numerical counts require a reliable native cursor/count contract.

Preserve independent drafts through switching and reconnect. Reload recovery
would use a separately defined installation/account-scoped browser cache and
logout-clear policy; cross-device drafts are a separate feature. Deleted
identities must never donate drafts to a newly created profile with the same
name.

## Roster freshness and removal

PC-001 is required chat behavior, not a cosmetic follow-up. Introduce one
coalescing roster reconciler with only one read in flight. After a confirmed
local or management mutation, invalidate and reconcile immediately. Refresh on
focus, reconnection and successful event resynchronization.

Add an authenticated `workspace.changed` invalidation event, separately
allowlisted from session events. Carry a revision/hint, not arbitrary native
payloads. Retain a bounded fallback check every five seconds while the app is
visible because external CLI changes and lost events may bypass plugin hooks.
Coalesce native reads across connected browsers and back off on failure. Use a
cheap roster/revision path rather than repeatedly invoking the current full
workspace description, which also queries model access.

The snapshot must cover profile membership, visibility, canonical bindings,
presentation revision and crew membership. Refresh must retire unavailable live
entries from management context while preserving historical identities. A failed
read is not evidence of deletion. Keep the last known list with stale/fresh
state, rather than turning a transient outage into mass removal.

Acceptance: controlled successful mutations update immediately; external changes
appear within six seconds on a visible healthy client. A second browser sees
the same result. Reconnect reconciles before reopening the prior conversation.

## Hiding and native deletion

The owner reports a stale sidebar after a management change involving a test
pebble; the exact removal/hiding operation is unknown. The refresh gap is
confirmed in code. The current typed
management tool does not implement Hide or Delete. Its actions are Enable,
Create, Update and Attach; Update edits role/reporting/team metadata.

Hide should set the verified native hidden metadata using whole-namespace CAS,
and roster adapters must honor that value. It preserves the profile, canonical
chat, personality, tools, routines and crew membership. Provide Show hidden and
Unhide. Disabling Bot Mode is a third distinct action and must not masquerade as
profile deletion.

Delete must use the actual native deletion lifecycle. Pinned af0 provides
`hermes_cli.profiles.delete_profile`, used by its CLI and dashboard; the
inspected stdio handler does not expose a `profiles.delete` RPC. Add a dedicated
narrow adapter after validating lifecycle coordination. Do not expose arbitrary
CLI execution, a general dashboard proxy or raw filesystem deletion.

Native deletion includes profile configuration, credentials, memory, sessions,
skills and cron data, and coordinates profile services, routing identity and
resources. It can report files deleted while identity settlement remains
pending. Shared crew history, removed-member behavior and parity on 29112 need
verification. Do not claim deletion erases external service data or backups.

Aurora or another permitted manager may propose an exact deletion; the owner
reviews its target and impact. Mark the approved request executing before
dispatch. Bind it to immutable target identity, expected revision and operation
ID, then revalidate before execution. Preserve completed, partial, uncertain and
failed-before-execution outcomes. A lost response triggers read-only
reconciliation, never automatic destructive replay.

The native default profile is undeletable. Reassign an orchestrator before
deleting it, and require a supported lifecycle for any profile hosting the
installation. Review active work, routines, reporting descendants and crew
membership explicitly. Coordinate live backends so they cannot recreate a
deleted profile directory.

Before enabling Delete, fix profile-name reuse: bind the workspace UUID to
verified native incarnation evidence or a validated plugin-owned identity
marker. Tombstone deleted identities and retain historical attribution. A new
profile with a reused name cannot inherit approvals, pins, drafts, read cursors,
roles or deletion receipts.

Recognize verified profile renames through native identity evidence rather than
treating every name change as deletion and recreation. Do not infer a rename
from similar names or persona text.

If a selected pebble is hidden, move navigation safely and retain its draft under
the hidden identity. If it is deleted, invalidate the conversation generation,
subscriptions, approvals and composer target. Show “This pebble was deleted.”
Keep unsent text recoverable and read-only; never transfer or send it to a
fallback selection. Reconnect must not enroll or create a replacement chat for
the deleted profile.

## Supported actions and capability gates

Native routine management supports profile-scoped pause/resume on the inspected
af0 build; the browser bridge currently lists routines only. Add one narrow
enabled-state operation with exact profile/job ownership, pending state,
authoritative refetch and error recovery. Display confirmed status rather than
a working-looking toggle until that operation is tested.

Stable transcript identities support reply display, but durable reply sending
is not part of the current text-only send contracts. Verify native metadata
semantics before offering Reply. Inserting quoted text is not a native threaded
reply.

Do not add attachment, voice, Library or Computer controls until their scoped
native flows exist. The first visual milestone should cover the working core
surface with no inert features.

## Implementation sequence

1. **Baseline and contracts.** Create populated synthetic fixtures for pinned
   pebbles, sections, crews, messages, routines, approvals and reconnect. Verify
   native metadata on both supported revisions. Define identity, roster
   invalidation and event reconciliation before adding attention indicators.
2. **Roster correctness and extraction.** Fix PC-001, honor hidden metadata and
   extract the shell, rail, transcript, composer and inspector with existing
   behavior intact. Separate connection, roster, selection, draft, activity and
   scroll reducers/hooks. Keep a usable running app after each extraction.
3. **Complete visual core.** Apply shared tokens, pinned shelf, compact grouped
   rows, crew stacks, bounded bubbles, actual timestamps, a small expanding
   composer and the selected identity panel. Remove daily-workspace boilerplate.
   Review the actual populated desktop and mobile screens together.
4. **Persistence and supported actions.** Wire authoritative pins/order,
   previews/read state and verified routine mutations. Add Hide/Unhide. Implement
   PC-002 only after native lifecycle, immutable identity and failure tests pass.
5. **Responsive behavior and release.** Finish tablet/phone drawers, back
   navigation, settings consistency and cross-device reconciliation. Run the
   installed native workflow and visual/interaction exit gates before release.

Desktop keeps three columns only while a useful minimum conversation width
remains. Tablet shows the rail and conversation with details in a side drawer.
Phone shows one of list, conversation and details at a time, with browser-back
behavior and retained state. Use dynamic viewport height, safe areas and
keyboard-aware composer placement. Drawers need focus containment, Escape,
backdrop dismissal and focus restoration. Pending approvals stay discoverable
when details are closed.

## Verification and release gates

Extend existing Playwright, native fixture, Vitest, plugin and avatar tests. Use
production components and synthetic content. Review rendered screenshots rather
than accepting a passing screenshot comparison alone.

- At 1440 by 900, two pins and eight normal rows should fit with a resting
  composer no taller than 56 CSS pixels and management controls kept compact.
- At 390 by 844, 320-pixel width and 200 percent zoom, there is no page-level
  horizontal overflow; send/stop and pending approvals remain reachable.
- Reading older messages preserves the scroll anchor within two CSS pixels
  during streaming, refresh and reconciliation. Following latest reaches the
  bottom within the same tolerance. New activity never pulls the reader away.
- Switching pebble to crew and back preserves separate drafts and scroll
  positions. Enter submits once, Shift+Enter inserts a line, and IME composition
  never submits. Uncertain sends are not blindly replayed.
- Ticket renewal, network loss and native restart preserve drafts and reconcile
  history without duplicate messages, false completion or stale Ready status.
- Stop remains pending until native evidence confirms its result. Approvals
  target the exact request and cannot execute against stale conversation state.
- Crew messages identify their actual participants; out-of-order and duplicate
  events do not duplicate bubbles. Native membership drives avatar stacks.
- Roster tests include selected/unselected and pinned pebbles, external changes,
  a second browser, missed events and reconnect. Hide/unhide preserves data.
- Delete tests include active work, routines, crews, name reuse, restart, lost
  acknowledgment, partial filesystem failure and identity settlement pending.
  Assert no duplicate destruction, directory resurrection or accidental chat
  recreation, on both pinned native revisions before enabling the feature.
- Routine switches prove ownership and recover authoritative state after failure.
  Keyboard focus, labels, contrast, non-color indicators and reduced motion pass
  review. Streaming must not repeatedly announce the whole transcript.
- Screenshot coverage includes populated desktop/tablet/phone, empty and long
  chats, code, crew authors, approvals, errors and reconnect. Preserve the avatar
  renderer's documented performance budgets.
- The installed end-to-end flow covers login, the existing primary pebble,
  canonical chat, response, approvals, Stop, crew conversation and restart.
  Native identity, SOUL, memory, tools and canonical history remain intact.

## Tools and remaining engineering checks

The existing repository, local native sources, avatar renderer and browser/test
tools are sufficient. No additional purchase, external design upload, remote
font or vendor asset is required from the owner.

Resolve metadata parity on 29112, cheap authoritative summary/read cursors,
native reply semantics, preference rollback and deletion lifecycle coordination
within the milestones above. The supplied reference provides enough visual
direction to begin; these checks do not require another round of aesthetic
questions.
