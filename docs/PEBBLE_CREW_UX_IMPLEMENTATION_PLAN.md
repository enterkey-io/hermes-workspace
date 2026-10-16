# Pebble Crew UX implementation plan

Date: 2026-10-16. Status: implementation authorized and completed in the 0.6.0
preview candidate, with the Computer Linux desktop gate retained. Verification
is recorded in [the implementation report](compatibility/preview-0.6.0-local.json).
The original acceptance plan follows the
[main-page audit](PEBBLE_CREW_UX_AUDIT.md), then the
[starter design system](PEBBLE_CREW_DESIGN_SYSTEM.md). Native feature constraints
are in [native capabilities](PEBBLE_CREW_NATIVE_CAPABILITIES.md).

## Outcome and invariants

Deliver a coherent, simple app across chat, rail, details, creation, editing,
Settings, requests, connections and account. Fix content and interaction
correctness first, then shared presentation and motion. Ship small independently
reviewable batches; no monolithic rewrite, Hermes core patch, new vendor account,
remote storage, product relay, or new infrastructure. Preserve exact native
compatibility and the owner's personalities, memories, skills, tools, profile
identities and canonical chats.

Keep stable internal `orchestrator`, `teams` and native operation names. Rename
human-facing text to Main Pebble and Crews. The recommended entity scheme is
Crew = organization; Group chat = native shared conversation. Do not migrate a
folder into a room, change frozen room participants or alter reporting during
restyling. Keep security enforcement server-side. A model cannot approve its own
request. Reversible preferences need immediate feedback, not confirmation loops;
actual destructive/native approval boundaries remain intact.

## Component and state migration

Introduce components beside existing production components, move one consumer at
a time, and remove obsolete CSS only after its last consumer is migrated. Do not
build a detached demo that diverges from the app. Keep App functional after every
extraction. Preserve MessageBody sanitization and the shared AvatarScheduler.

| Layer                | Proposed responsibility                                                                                                         | First consumers                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Shared tokens        | semantic color/type/space/radius/target/motion/layer values; one source                                                         | Menu, composer, rail; then all forms                 |
| `ui` primitives      | Button, IconButton, transparent OverflowTrigger, Field, FormSection, Menu, Dialog/Drawer, Tabs, Status, EmptyState, List, Table | Rail actions and details; then editors/Settings      |
| Timeline adapter     | lossless normalized native records → typed visible items; source IDs/cursors retained                                           | Restored history and live transcript together        |
| Mutation state       | identity+operation+revision keyed intent, pending/confirmed/failed/uncertain, authoritative reconciliation                      | Pin, hide, routine switch, form saves                |
| Shell state          | rail/details visibility, responsive mode, overlay ownership, last valid focus                                                   | Desktop toggle and phone drawers                     |
| Conversation state   | selection incarnation, drafts, streams, approvals, read coverage, scroll anchor                                                 | Preserve existing behavior while extracting from App |
| Entity editor        | form draft/dirty/error/result independent of roster refresh                                                                     | Edit pebble; then New pebble/New crew                |
| Capabilities         | supported/unsupported/unavailable/unknown per native revision, host, identity and session                                       | Files/attachments/Computer; no optimistic capability |
| Owner-local adapters | narrowly typed native operations and scoped upload/download/display transport                                                   | Feature batches only after native prototypes         |

Do not introduce a generic state framework, new UI framework, global event bus or
client-side permission authority merely for this work. Shared hooks/reducers and
typed adapters are sufficient until measured complexity establishes otherwise.
Preferences can remain local where device-specific; durable pin/organization
records retain their existing owner/native authority. Do not store chat bodies
in owner auth tables.

## Sequence and dependencies

Each batch ends with focused behavior tests, rendered review and a bounded diff.
A passing gate permits the next batch; it is not evidence that later conditional
features are delivered. No owner installation update occurs as part of planning.

### Batch 0 — Evidence fixtures and contract decisions

Resolve UX-04 entity mapping and capture the exact baseline for UX-01/02/07/08/15.
Use synthetic identities/content and current production components. Record native
payload shapes for both supported revisions with: normal answers, tool-call-only
assistant records, text+tool calls, meaningful tool output, failures, approvals,
sidecars, attachment refs and missing timestamps. Identify permitted visibility
for reasoning/sidecars rather than dumping them into the browser.

Measure pin from input → local pending feedback → mutation dispatch → native
compare-and-swap → authoritative snapshot → confirmed paint. Record server/native
spans where available so transport, native work and rendering are distinguishable. Inspect the hovered composer element/computed cursor and focus
outline, rather than adding broad pointer overrides speculatively. Capture menus
at left/right/top/bottom and Settings edits through an external roster refresh.
Document viewport/browser/revision for all interactive reproduction evidence.

**Gate:** review the main-page audit and proposed component/state specimens
(menu, row/pin, transcript/activity, composer, details, form, list/table) before
sweeping migration. Reuse local production fixture tooling; no Storybook, external
canvas, new infrastructure, or platform framework choice is required. Canonical
timeline/identity/cursor mapping and Crew versus Group chat model documented; captured failures reproducible with no private payloads in
fixtures. No production data mutation is needed. Native capability prototypes
can be investigated independently after this batch, without blocking core fixes.

### Batch 1 — Correct transcript content and feedback

Addresses UX-01 plus relevant UX-16. Extend the typed adapter in `conversation.ts`
and appropriate shared protocol/core types, retaining native IDs, structured
content, tool name/call identity/status, turn boundaries and author/time metadata.
Keep native history intact. Introduce a pure projection layer before Transcript;
do not use JSX filtering as the data model or replace row identity with indexes.

Render nonempty answers as Message; contiguous verified activity as expandable
ActivityGroup; approval/error/file content as their own typed items. A record with
no visible content or metadata creates no message article, Copy action, timestamp
bubble or orphan divider. A record with meaningful sidecars is classified first.
Unknown substantive records remain inspectable in a bounded safe fallback.
Never expose secrets or hidden reasoning through generic JSON detail panels.

Use the same projector for live updates and reconnect history. Preserve author
attribution and mixed content. Keep read cursor tracking tied to native coverage,
not visible message count; grouping must not mark unloaded history read. Collapse
activity without collapsing approvals/errors requiring user action. Avoid false
“completed” group labels when native tool results are absent or uncertain.

**Gate:** synthetic native payload fixtures verify answer content, tool results,
structured details and approvals survive; timestamps and copy only exist for
meaningful visible items; streaming→history/reconnect gives one reply, stable
IDs and correct read state. Review real restored canonical tool history on both
pinned builds before release. This batch can ship without Files or Computer.

### Batch 2 — Shared interaction primitives and immediate usability

Addresses UX-02/06/07/15 and UX-16 focus/targets. Establish token file and Button,
IconButton, transparent OverflowTrigger, Menu/Popover, Field, Status and dialog
focus infrastructure. Migrate only the first consumers: rail actions and composer.

Portal menu to an overlay root belonging to the active modal when applicable;
flip/shift against the visual viewport with 8px clearance and bounded height.
Update on scroll/resize/zoom without recurring work while closed. Close on
selection/Escape/outside action; return focus to a valid trigger or row fallback.
Three-dot trigger stays transparent on hover; use glyph contrast and focus ring.
Touch actions must be discoverable on tablets as well as phone breakpoints.

Composer editable area uses text cursor and a visible focus-within treatment;
inspect and correct the actual hit-area cause if reproduced. Padding can focus
the textarea without intercepting selection, attachments, Send or Stop. Preserve
IME composition, multiline entry, draft scope and current disabled explanations.
Menus and modal primitives must cover selects, links, summaries and all intended
focusable controls, use background inerting for modals, and manage overlay stacks.

**Gate:** keyboard/touch menu action works on every edge at 320px/390px/tablet/
wide desktop and 200% text zoom; no clipping or background focus. Enter/Space
opens, Escape closes, arrows behave for menu semantics, focus returns after a
row moves/disappears. Pointer is text over editable composer; focus is visible;
Send/Stop remain reachable. Check contrast/forced colors in rendered states.

### Batch 3 — Rail identity, account menu, and pin reconciliation

Addresses UX-08/09/10/11/13 and part of UX-14. Center the shelf for 1/2/3/more pins;
retain stable order and readable labels. Ordinary row name and real role title
share a line; optional long titles truncate visually with full detail available.
Use verified Main Pebble designation, not invented job titles. Add accessible
unread text and explicit hidden/stale statuses. Do not infer canonical previews
from raw tool names.

Introduce per-identity pin intent with revision/operation sequence. Show pending
within 100ms target on baseline hardware; disable duplicate same-target intent.
Provisional movement may happen immediately, but saved status waits for native
confirmation. Coalesce authoritative refresh; ignore older response generations.
Failed mutation restores placement and explains retry; uncertain response triggers
read-only reconciliation. Two tabs and external native changes settle on the
newest valid authoritative state. Preserve unrelated pins/metadata.

Add 200–240ms FLIP/shared-layout movement only after the above works. One semantic
identity is rendered; animation clone is inert. Restore focus on its corresponding
control, preserve rail scroll, cancel cleanly on reduced motion/resize/search/
new intent/deletion. Keep a keyboard move action; drag/reorder is optional and
must not replace accessible actions.

Replace two-row footer with owner avatar/initial menu containing actual Settings,
Show hidden and Sign out/Disconnect actions. Keep important disconnect feedback
visible. Apply Main Pebble copy migration across UI, accessible labels, runtime
errors, tool descriptions, management skill and generated prompt prose while
retaining protocol identifiers. Review the diff rather than global replacement.

**Gate:** delayed/failed/conflicting/unknown pin responses never show false success;
focus and identity survive movement; one request per intent; no new poll loop.
Screenshots prove centering and adjacent role chips with missing/long metadata.
All footer actions remain reachable by touch and keyboard. Text inventory finds
no accidental human-facing Orchestrator/Teams outside deliberate technical or
historical context; native schemas still match both supported versions.

### Batch 4 — Details panel, tabs, avatar badge, and bounded motion

Addresses UX-12/14. Add small sliders trigger on desktop/tablet/phone with accurate
expanded state and Close details inside. Desktop aside is optional/nonmodal;
small-screen drawer is modal. Mount only one interactive details instance; avoid
duplicate routine/approval controls and duplicated live announcements. Preserve
per-conversation scroll anchor and composer draft while text rewraps.

Remove idle Ready. Move routines into Routines tab; create reusable tabs with
keyboard/ARIA behavior. Files and Computer slots follow capabilities and are not
exposed as working tabs until later gates. Keep pending approvals reachable in
the chat header/nudge even with details hidden. Fix badge placement using visible
avatar geometry/photo bounds for every shape and row/pin/detail scale; retain
scheduler and photo behavior. Label Main Pebble in accessible identity context.

Add 180–220ms panel transition and bounded Latest messages scroll. Explicit Latest
moves in 180–280ms; reader wheel/touch/key cancels; new streaming content settles
at bottom only if intent remains follow-latest. Reduced motion is immediate.
Automatic restoration/refetch never smooth-scrolls. Anchor recovery uses native
message ID/offset; do not rely solely on old scrollTop after width changes.

**Gate:** desktop open/close and narrow drawer restore correct focus; browser Back
closes one overlay without leaving stale history entries; closed details releases
viewer work; approval remains discoverable. Anchor offset changes by at most 2px
after settled content unless removed, with a defined nearest-message fallback.
Latest is visibly smooth, bounded, cancellable and instant under reduced motion;
no focus loss when its button disappears. Visual review covers all avatar shapes,
photos, dynamic composer height, 320px and zoom.

### Batch 5 — Unified forms and focused pebble editors

Addresses UX-05/06 plus editing parts of UX-03/16. Introduce FormSection,
FormActions, field-level errors, loading/empty/error states, selection lists and
human-readable request diff fields. Use these in Edit pebble and Add existing
first. Maintain avatar preview and original avatar controls with consistent focus,
selection and geometry. No new placeholder icons or alternate avatar system.

Separate form drafts from authoritative roster; no editor remount on every global
revision. Define operation ordering and results for handle/avatar/role/tool saves.
Either use scoped saves or a composite orchestrator with per-section receipts;
never claim an unsupported atomic transaction. Saved sections update baseline;
unsaved sections remain. Concurrent change shows a focused resolve/reload choice
without wiping typed values. Dirty navigation confirmation appears only when
needed. Keep model-access/credential/tool grants scoped and explicit.

New pebble branch: Add existing enrolls actual profiles and reuses native Bot
Chats. Create new uses the real fresh-profile management path, verified native
schema, exact proposal and owner approval once where required. No generic fresh
profile action before that adapter path is real. Persist pending/partial/uncertain
outcome so retry cannot duplicate a profile. Show concise title/labels and actual
status; remove eyebrow/explainer clutter from the primary path.

**Gate:** edit/save/fail/partial/external-refresh preserves intended and unsaved
values; errors link to fields and focus correctly; selected identity never drifts.
Add existing preserves SOUL/memory/tools/history; Create new proves distinct native
identity, exact approval, canonical setup and uncertain-outcome reconciliation.
Keyboard, screen reader and mobile keyboard can complete both branches without
extra confirmation loops. Installation data is synthetic and disposable.

### Batch 6 — Rail creation and Crew organization

Addresses UX-04; depends on Batches 2/3/5. Rail + menu offers New pebble / New crew.
New crew uses compact name/member selection and supported existing organization
metadata. Name validation, duplicate names and one-crew-per-profile constraints
come from the actual schema. For members already in another crew, show the exact
move in the form before saving; never imply multiple membership if unsupported.
Use compare-and-swap revision, pending state and authoritative reconciliation.

Remove Settings creation/Teams tab after rail entry point is complete. Crew
headings provide appropriate rename/member/reorder/remove actions backed by real
operations. Preserve stored IDs and previous order. Group chats have a distinct
section with existing native room identities. Optional Start group chat remains
behind a real adapter gate: native groups.create, chosen 2–6 supported participants,
exact name/thread semantics and authoritative result. Organization changes trigger
no model run. Existing room membership stays frozen; new participants require a
new conversation. Any association is explicit optional owner-local metadata.

**Gate:** upgrade from populated old teams retains each profile, group room,
participant and reporting relation; create/rename/remove organization never erases
native data. New crew is available from rail on all sizes and never Settings.
Start group chat, if included, creates exactly one actual native room, preserves
2–6 limit, and handles lost acknowledgment without blind retry. Otherwise omit
the unimplemented action and mark that subfeature pending.

### Batch 7 — Settings, requests, connections, account, and setup consistency

Addresses UX-03/06/16. Migrate remaining real Settings destinations to shared
navigation, tokens and primitives. Keep editors/creation out of global settings;
provide clear return to prior conversation. Adopt request rows/cards with readable
before/after values instead of raw keys/JSON while preserving exact target and
native approval semantics. Complete Account password/session forms; retain real
server session revocation timing. Do not add fictitious owner profiles or usage.

Connections explicitly identify the selected native profile. Guard async fetches
against profile switches and out-of-order response; show loading, last-known stale
state, empty and failure distinctly. Preserve authorization/test/tool-grant
separation; style it coherently without collapsing its security effects. Use
lists for small sets and tables only where genuine column comparison helps.

Migrate login/setup to the same token/form system while retaining concise existing
primary-agent identification and same-origin owner flow. No endpoint/pairing form
in combined onboarding. Verify all primary and secondary flows, not just the
chat screenshot. Remove superseded style rules in bounded diffs.

**Gate:** user can navigate account, integrations, requests, edit and back with
correct focus/draft/context; a delayed previous-profile connection response never
renders as the current profile. Field errors, async status, tabs/navigation,
contrast, keyboard and mobile reflow pass manual review. Login/setup still targets
the existing primary Hermes agent and preserves actual data. No new capability
or permission is inferred from the visual redesign.

### Batch 8 — Real attachments and Files

Addresses UX-15 and Files part of UX-12; depends on Batch 0 native contract proof,
Batch 1 typed timeline, Batch 2 primitives, and Batch 5 field/mutation patterns.
Can proceed independently of Computer; it is not a cosmetic paperclip task.

Follow the [native capability report](PEBBLE_CREW_NATIVE_CAPABILITIES.md): dedicated
owner-authenticated bounded upload route, opaque identity/conversation-scoped IDs,
private staging, decoded size/count/storage caps, content validation, path/symlink
protection, cancellation and expiration. Preserve normal RPC 64KiB limit; do not
raise every request limit. Respect native stdout frame constraints and PDF
45s adapter versus up-to-120s native conversion mismatch with explicit scoped
job/progress design, not a global timeout increase. Product limits are proposed
policy until prototype and installation tests establish them; render capability
limits from the actual server response.

Pick/paste/drop creates a draft attachment only. No model execution/native image
queue mutation on file selection. On Send, revalidate exact session/profile
incarnation, serialize staging+submission per conversation, include returned
`@file:` refs, bind pending image queue ownership, and record receipts. Attachment-
only sends require an explicit contract. Disconnection/unknown result reconciles
before retry; don't duplicate prompts or cross-contaminate two tabs' image queues.

Add progress chips, cancellation/remove/retry/error and send-readiness states;
keep drafts across selection/reconnect under the correct identity. Files tab
lists verified conversation inputs and outputs using scoped owner-local index
and safe download/preview paths. Distinguish uploaded/not sent from sent. Removing
a draft chip cannot delete files referenced by history. No arbitrary path browser,
remote-link auto-fetch, or active HTML/SVG preview on the authenticated origin.
Historical native references need verified scoped import/provenance. Group-chat
files are separately gated on real delivery to the selected native participants;
start with direct pebble chats if that is the only proved path.

**Gate:** both pinned native revisions show one actual file reaching the selected
pebble and surviving reload; cancel/retry/duplicate names/MIME mismatch/oversize/
quota/full disk/vision unavailable/PDF dependencies/timeout all show truthful
states. Tests reject traversal, symlink, cross-profile ID, reused profile name,
CSRF/unauthorized access and expired upload. Two tabs/profile switch/restart/
uncertain Send never leak or duplicate staged input. No Files completion claim
before real historical association/download is demonstrated.

### Batch 9 — Native Computer prototype, then conditional viewer

Addresses Computer part of UX-12. Independently gated; absence of support must
not hold up verified core UI fixes or file support. Read the native capability
report before selecting the transport. af0 offers a native Linux profile screen;
29112 has no equivalent handler surface. A profile screen is not an isolated OS.

First prove capability/status probing and an authenticated owner-local viewer
transport that preserves native RFB control filtering/leases. Native tickets are
in memory per process: minting in the plugin's stdio child and redeeming in an
unrelated dashboard process will not work. Prove mint and redemption in the same
trusted process or another correctly authenticated native transport. No Hermes
core patch, whole-dashboard proxy, exposed raw VNC port, arbitrary socket path,
weakened auth, or product relay. If this cannot be achieved, record blocked native
integration and keep Computer out of released navigation.

Then build lazy viewer: default Watch, explicit Take control/Hand back, exact
profile identity, start/status/stop semantics, another-viewer ownership, revocation,
expiry/replay protection and reconnect. Distinguish deliberate close from network
loss according to native lease behavior; don't hand control to the agent during
an owner's interrupted sensitive interaction. Require actual packages/backend;
no automatic install/sudo/container changes on page load. Platform/dependency
setup is a separate explicit installation action.

**Gate:** prototype proves one correct profile's live screen through same-origin
owner authentication with control enforced server-side and natively. Check missing
packages, unsupported revision/host, denied origin, expired/replayed ticket,
cross-profile substitution, two viewers, lease takeover, lost connection, hidden
tab, close/unmount, logout and restart. Measure backpressure/CPU and confirm closed
viewer stops receiving data. Supported deployments and installer paths must be
verified before enabling; static source/native docs do not complete this feature.

### Batch 10 — Integrated usability, accessibility and installed release gate

Addresses UX-06/16 and validates every preceding batch. Run one coherent owner
journey: login → existing Main Pebble → real reply/tool activity → Stop → review →
New pebble existing/fresh → New crew → group chat if enabled → pin/search/edit →
Settings/account → attachments/Files if enabled → Computer if enabled → restart.
Check no invented action, stale identity, data loss or confirmation loop.

Review rendered desktop/tablet/phone screens together with synthetic varied data,
including 1/2/3/7 pins, missing/long titles, no/many crews, 10k history rows where
supported, code/tables, pending/failed approvals, hidden/deleted identity, slow
connection and empty/loading/stale states. Real handset/software keyboard checks
complement browser emulation. Full a11y and native gates below apply.

**Gate:** only implemented, verified capabilities are enabled. Record exact source,
bundle/native versions, browsers, fixtures, manual findings and known limits.
This planning pass publishes nothing; later execution/release follows the
user-authorized scope and records owner-host deployment separately. No blanket “complete” label if Files,
Computer, a platform, or installer remains gated.

## Issue-by-issue acceptance and evidence ledger

The audit IDs cover every item in the owner's report. Keep each open until its
acceptance evidence exists; proposed design and passing unit tests are insufficient.

| ID    | Deliverable                                  | Batch / dependencies   | Concrete acceptance evidence                                                                                                                                 |
| ----- | -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UX-01 | Meaningful replies + grouped tool activity   | 0→1                    | Real native restored/live tool history; no timestamp-only bubbles; text/sidecars/approvals/errors/files retained safely; no duplicate/read-cursor regression |
| UX-02 | Collision-aware menu                         | 2                      | Every viewport edge, zoom, scrolling rail and modal; all menu items visible/operable; Escape/outside/focus restoration                                       |
| UX-03 | Fully redesigned Settings                    | 5→7                    | Account/connections/requests/editor navigation reviewed with populated/error states on desktop/mobile; no leftover old tab/form layout                       |
| UX-04 | Crews from rail; distinct Group chats        | 0→5→6                  | New pebble/New crew menu; no creation in Settings; no Teams copy; migration snapshot proves native organization/room/reporting preserved                     |
| UX-05 | Coherent Add/Edit/New forms                  | 5                      | Existing versus fresh choices clear; native result verified; no unsaved-field loss; exact approval only where needed; partial retry safe                     |
| UX-06 | Whole-product system                         | 2→5→7→10               | Token/component/state inventory adopted across login/setup/chat/forms/lists/tables/requests/account; rendered cross-flow review                              |
| UX-07 | Transparent three-dot trigger                | 2                      | Computed background transparent at idle/hover; glyph and focus ring legible; menu panel surfaced; touch discovery and adequate target                        |
| UX-08 | Fast honest pin feedback + movement          | 3                      | Traced click feedback target <100ms; delayed/failed/uncertain/conflicting native responses; animated identity/focus preservation, authoritative rollback     |
| UX-09 | Centered pins                                | 3                      | 1/2/3/7 pins, incomplete last row, search and resize; unchanged stable saved order                                                                           |
| UX-10 | Role chip next to name                       | 3                      | Real title beside ordinary name; long/missing title and genuine Main Pebble fallback; no fabricated role                                                     |
| UX-11 | Main Pebble language                         | 3 plus 5/7             | UI/accessibility/tool/skill/prompt copy audit; native IDs/schema and reporting unchanged                                                                     |
| UX-12 | Toggleable details, attached star, real tabs | 4; Files 8; Computer 9 | Desktop and mobile close/reopen/focus/anchor; no Ready; all shapes/photo badge; Routines tab; real Files/Computer evidence separately                        |
| UX-13 | Owner avatar menu                            | 3                      | Settings/hidden/sign-out functional with keyboard/touch; visible connection failure; no fake accounts/usage/upsell actions                                   |
| UX-14 | Gentle Latest and coherent motion            | 3/4/10                 | Bounded, cancellable Latest; stable history restore; reduced-motion equivalence; menu/panel/reorder/hover reviewed with trace                                |
| UX-15 | Text caret + real attachments                | 0→2; 8                 | Computed cursor/hit-area/focus evidence; actual native file receipt and reload; upload limits/path/identity/queue/timeout gates                              |
| UX-16 | Accessibility, resilience, architecture      | Every batch→10         | Manual keyboard/SR/contrast/reflow/mobile/slow-network/native/installer matrix; exact limits documented, no blanket certification                            |

## Verification matrix and quality gates

Use tests asserting user outcomes and security invariants, not snapshots of
implementation internals. Keep checks focused per batch; broaden when new changes
or unresolved failures justify it. Never cite test counts to dismiss the owner's
visual/usability report.

| Area              | Scenarios                                                                                                                                                                               | Evidence required                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Timeline          | text-only, whitespace+sidecars, text+tools, meaningful tool output, unknown structured content, approval/error, interrupted turn, missing timestamp, duplicate/out-of-order live events | Adapter fixtures plus production transcript review and native canonical reload on both pins                                    |
| Navigation/state  | pebble↔group, details open/close, Settings return, filter, hide/delete selection, profile name reuse, reconnect/restart                                                                 | Drafts stay on exact identity; no wrong-target send; stable scroll/read scope; valid focus                                     |
| Keyboard          | all actions, menu arrows/Escape, dialogs, select/summary/link focus, tabs, IME Enter, Shift+Enter, Stop, attachment remove                                                              | Manual end-to-end route with visible focus and no traps outside intended modal                                                 |
| Screen reader     | names/roles/states, unread, tool expansion, completion/error, approval review, field errors, dialog context                                                                             | VoiceOver/Safari and NVDA with Chrome/Firefox; concise announcements, no streamed-log repetition                               |
| Visual/contrast   | selected+hover+pending+error+disabled, transparent overflow, badges, chip truncation, forced colors                                                                                     | Measured rendered color pairs; 4.5:1 normal text/3:1 essential nontext; screenshot review                                      |
| Responsive        | 320/390/768/1024/1440/wide widths, short viewport, 200% text zoom, 400% reflow, touch coarse pointer, software keyboard, safe area                                                      | No page-level horizontal overflow; essential actions reachable; meaningful local code/table scroll                             |
| Motion/scroll     | Latest during stream, cancel mid-scroll, panel reflow, pin rollback, route/filter change, live reduced-motion toggle                                                                    | Settled anchor tolerance ≤2px where source item survives; bounded motion; no focus/semantic clone issues                       |
| Network/mutations | delayed RPC, timeout, failed-before-dispatch, lost response, external newer revision, two tabs, reconnect                                                                               | Immediate pending; no false success/blind destructive or send replay; authoritative state wins                                 |
| Files             | direct native delivery, group unsupported, size/count/quota, MIME/path/symlink, two tabs, changed identity, canceled upload, expired staged blob, restart                               | Local authenticated boundary and real model/tool receipt/reload; scoped downloads/index; no cross-target leak                  |
| Computer          | unsupported revision/OS/backend/deps, process-bound ticket, origin/auth, lease/takeover/reconnect/logout                                                                                | Live prototype plus denial tests; real input gating and teardown; no isolation claim                                           |
| Performance       | representative large roster/history, avatars, typing while streaming, menu/pin/panel, optional screen viewer                                                                            | Browser trace compared to baseline; no long-lived new timer/observer leak, extra roster polls or closed viewer traffic         |
| Installations     | combined plugin native start/restart/upgrade, real owner-local HTTPS paths, supported host variants and both pinned native revisions                                                    | Disposable actual installation runs; identity/memory/tools/history intact; host-specific unsupported features explicitly gated |

Automated accessibility scans supplement manual tests; they cannot establish
screen-reader quality, meaningful status, keyboard software behavior, or overall
WCAG conformance. Synthetic browser fixtures prove UI behavior, not live RPC
latency, installation compatibility, or native file/screen delivery. Record each
evidence type honestly using the audit vocabulary.

## Review and release reporting

At each batch provide: changed behavior, synthetic rendered evidence, focused
checks, remaining risks/gates and rollback path. Revert a presentation batch
without reverting native records; any new owner-local metadata must be optional,
versioned, and ignored safely by the previous UI. Preserve source pin validation.
Stable UX-01–UX-16 map respectively to backlog PC-008–PC-023.
A release note distinguishes implemented, locally verified, published and
owner-installed. Conditional Files/Computer/group-chat creation remains visible
in the backlog until its actual gate passes, even if its UI shell is designed.

## Implementation record

The owner authorized inline implementation after reviewing this plan. Shared
tokens and primitives now serve production menus, tabs, forms and overlays.
Settings and pebble creation/editing use those components. The transcript adapter,
identity-scoped pin intents, guarded form drafts, private file store/native
attachment helper, typed Crew adapter and optional native screen broker are
implemented. Management pages and the screen decoder load lazily.

The Computer gate is narrower than a full Linux certification: real native ticket
redemption, RFB input filtering, control and clean hand-back passed with a
synthetic framebuffer on the development Mac. Linux package installation, Xvnc
startup and desktop use on the owner host remain unverified. File support covers
direct-chat inputs and downloads; group delivery and automatic generated-output
indexing are deferred. See the release report for executed checks and limits.

The experimental Computer viewer remains disabled by default while Linux
acceptance is open. Explicit operator-only test opt-in is
`HERMES_BOT_WEB_EXPERIMENTAL_COMPUTER=1`; native revision/host checks still apply.
