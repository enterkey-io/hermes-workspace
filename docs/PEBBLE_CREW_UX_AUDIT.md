# Pebble Crew UI, usability, and accessibility audit

Date: 2026-10-16. Baseline: source `af75aa3`, main0.5.0-preview.1 context.
Status: investigation and proposed direction only; no implementation, release,
owner-host change, or native runtime verification was performed for this audit.
A separate isolated synthetic browser check supplied the reproduced evidence below.

This audit precedes the [design system](PEBBLE_CREW_DESIGN_SYSTEM.md) and
[implementation plan](PEBBLE_CREW_UX_IMPLEMENTATION_PLAN.md). It supplements the
historical [UI plan](PEBBLE_CREW_UI_PLAN.md); that document's implemented label
is not evidence that the present experience is complete. Stable UX IDs below map sequentially to backlog PC-008–PC-023
(UX-01 → PC-008 through UX-16 → PC-023).
The root backlog owns publication/deployment status.

## Evidence and scope

- **user-observed**: the owner's direct report; valid evidence of their experience,
  but does not establish the cause or affected browser/version.
- **screenshot-observed**: visible in a locally inspected image; establishes a
  captured state, not interaction, speed, accessibility, or current deployment.
- **code-confirmed**: a behavior or contract is directly present in this checkout.
- **reproduced**: exercised in an isolated synthetic browser fixture during this
  audit; the label is limited to the tested presentation path, not the owner host.
- **inferred**: a likely consequence or cause requiring a targeted runtime check.
- **unknown**: evidence is insufficient; the implementation gate must resolve it.

Inspected local synthetic screenshots: `test-results/workspace-desktop.png`,
`workspace-mobile-390.png`, `workspace-rail-390.png`. They show production
components with synthetic identities; their generation timestamp and deployed
version are not established here. Also inspected the owner's private tool-bubble
capture and the supplied full Grok/reference account-menu captures locally.
Only structural observations are recorded; private conversation text is neither
copied into these documents nor sent to a design service.

Source investigation covers App, conversation projection, Rail, Transcript,
Inspector, Drawer, RequestReview, Settings, AgentPicker, shared Avatar, setup,
owner account, shared CSS, and workspace types. Native feature investigation is
recorded separately in [native capabilities](PEBBLE_CREW_NATIVE_CAPABILITIES.md).
The [sanitized browser evidence](compatibility/ux-audit-2026-10-16.json) records
source/bundle hashes, intercepted synthetic fixtures, desktop and phone bounds,
and limitations. The staged production bundle was used without a fresh build;
bundle reproducibility was not revalidated. Local captures under
`artifacts/ux-audit-2026-10-16/` show menu/tool history/Settings states.

Static inspection is not a WCAG certification, performance result, mobile
keyboard test, native integration result, or installer certification.

## Overall finding

The main page has a useful charcoal foundation and real native conversations,
but the interaction model is inconsistent. Raw events become message bubbles;
creation and editing lead to older management screens; small controls and
clipped menus reduce usability; panels consume space without an owner-controlled
visibility model. The sidebar mixes organization, reporting, and shared chats
without giving those entities sufficiently clear names. A coherent product
requires fixing these contracts and flows before adding decorative polish.

Preserve the safe Markdown renderer, actual native history/identity, canonical
Bot Chats, immutable approval targets, separate drafts, current avatar scheduler,
and owner-local architecture. Passing existing tests cannot substitute for
acceptance of the reported experience.

## Traceable findings

### UX-01 — Transcript projects activity as messages · high

**user-observed, screenshot-observed, code-confirmed, reproduced with synthetic
history; original native payload correlation inferred.**
The private capture shows timestamp-only bubbles interspersed with tiny Tool
bubbles naming operations. `apps/web/src/conversation.ts:9` retains every user,
assistant, and tool row, preserves empty text, and falls back to `name` when text
is absent. `chat/Transcript.tsx:26` renders an article, metadata, and Copy for every
row, irrespective of meaningful content. This directly permits the captured
presentation. The isolated Chrome fixture reproduced one empty assistant bubble and one
tool-name bubble from injected synthetic rows. The exact original native payload
has not been replayed. Native af0 history skips
empty content unless structured assistant sidecars exist (`session_history.py:285`);
our adapter discards those sidecars and tool context. Thus apparent blank bubbles
can be a lossy projection of meaningful records, not inherently blank native rows.

Required outcome: readable answers with expandable activity belonging to the
correct turn. Preserve nonempty assistant text, actionable failures, approvals,
files, and unknown substantive content. Do not solve this by dropping all tool
rows or all empty-text records: those can carry meaningful structured content.
Preserve native IDs and cursor scope independently of visible bubble count.
See the timeline contract and adversarial fixtures in the implementation plan.

### UX-02 — Pinned menu can leave the viewport · high

**user-observed, code-confirmed, screenshot-observed, reproduced.**
`chat/chat.css:264` positions the menu at the tile's upper-right; `:292` places a
140px panel right-aligned below that point. A leftmost narrow tile has insufficient
space to its left. `:64` and `:95` clip the sidebar/scroll area. `Rail.tsx:164`
uses `<details>` without collision handling, Escape dismissal, outside dismissal,
or explicit return-focus management.

The synthetic browser check measured the menu at x=-26.34375px on a 1440px
viewport and x=-22px on a 390px viewport, both 140px wide. Left clipping is
reproduced, not merely inferred from CSS.

Required outcome: a shared overlay layer, viewport collision handling, visible
focus, keyboard/touch access, and safe dismissal after an action. Verify all
edges, scroll positions, text zoom, and RTL if supported. A high z-index alone
cannot fix overflow clipping.

### UX-03 — Settings is a second visual and interaction system · high

**user-observed, code-confirmed, screenshot-observed.**
`WorkspaceSettings.tsx:106` emits internal agents/teams/requests/connections/account
strings as tab labels (visually capitalized by CSS). The synthetic browser
fixture shows four forms/eight fields and the older expanded form layout. `:135` adds a
profile selector before dense forms; `:336` onward splits editing into many
separate saves. `style.css:856` and `chat/chat.css:961` layer old form styling with
chat overrides. `WorkspaceSettings.tsx:58` fetches profile connections without a
request-generation guard; a late response may populate a newly selected profile
(**inferred**, reproduce before declaring a data exposure or wrong-target save).

Required outcome: the same tokens, fields, navigation, feedback, and responsive
rules across every surface. Move creation to the rail, pebble editing to a focused
entity editor, and retain actual account/integration/preferences controls in
Settings. Preserve explicit scope for every connection and credential action.

### UX-04 — Teams, Crews, and native rooms need honest organization · high

**user-observed, code-confirmed.** `Rail.tsx:150` uses `workspace.teams` as section
headings; `:306` separately lists native rooms as Crews. `WorkspaceSettings.tsx:158`
creates sidebar-only teams in Settings. `:384` updates role, manager, and team
metadata together; these are distinct concepts. `workspace.ts:32` and `:40` retain
stable `team`, `teams`, and `orchestrator` contract fields.

Required outcome: no user-facing Teams; rail + offers **New pebble** and **New
crew**. Adopt the explicit entity mapping in the design system before writes.
Never rename an organizational folder into an apparent shared conversation,
change native room membership, or move reporting relationships as a cosmetic
migration. Existing crew chats, organizational membership, and reporting must
remain intact. If a unified entity cannot be backed by an explicit relationship,
keep the distinction visible and settle the narrow mapping decision first.

### UX-05 — Add and Edit pebble are confusing, dense flows · high

**user-observed, code-confirmed.** `AgentPicker.tsx:73` enables selected existing
profiles; it does not create fresh profiles. `:98` contains an eyebrow, broad
heading, explanation, disclosure, search, result counts, and multiple actions.
`WorkspaceSettings.tsx:336` onward offers separate handle/avatar/role forms plus
permissions and transfer controls. `:150` keys BotEditor by global revision;
refresh after one save remounts the editor and can discard other unsaved sections
(**inferred**; exercise before treating loss as reproduced).

Required outcome: explicit **Create new** / **Add existing** branches under New
pebble; existing enrollment retains native personality and chat; creation names
its real profile/model/tool choices and approval state. One consistent editor
with deliberate save boundaries and preserved drafts. Do not invent a direct
creation endpoint or silently turn add-existing into cloning.

### UX-06 — Main-page review does not yet cover the full product · high

**code-confirmed, inferred.** Chat components and tokens exist, but settings,
requests, connections, account, enrollment, and setup still have distinct patterns.
The historical plan claimed settings consistency in its final milestone, while
the current source and owner's report show unfinished work. Lists and future
file tables need the same behavior standards as messages and forms.

Required outcome: a component/state inventory, foundation tokens, reusable
primitives, and migration order spanning all flows. The proposed system below is
a starter specification, not a claim that components have been implemented.

### UX-07 — Overflow trigger must stay transparent · medium

**user-observed, code-confirmed.** `chat/chat.css:271` gives summary a 26px target,
zero idle opacity, and no direct summary-hover rule. Ancestor hover/focus/open
sets background at `:285`; this means source does contain some hover background,
so the owner's observed transparent state needs an exact browser/state check.
The owner explicitly requests a transparent three-dot trigger with **no hover
background**; the current ancestor-hover background conflicts with that direction.
Touch visibility is only restored at the phone breakpoint (`:1059`), missing large touch screens.

Required outcome: real IconButton semantics with a transparent background in idle
and hover states. Use glyph contrast/opacity, expanded indication, and a visible
focus ring for interaction feedback; the menu panel itself remains surfaced. Keep
dependable discovery on coarse pointers and adequate targets without enlarging
the glyph. Other controls retain smooth, legible hover backgrounds. Do not nest an action inside the row button.

### UX-08 — Pin waits, then jumps · high

**user-observed, code-confirmed; latency source unknown.** `App.tsx:836` waits for
the mutation then roster load; `:1024` routes pin through this path. There is no
per-pebble pending intent or provisional presentation. `Rail.tsx:142` derives pin
placement directly from authoritative data, causing a discrete list-to-shelf move.
No timing trace establishes how much delay belongs to RPC, refresh, rendering,
or the owner's host.

Required outcome: acknowledge the input immediately, preserve identity/focus,
and show pending truthfully. Use reversible optimistic pin presentation only
with authoritative reconciliation, rollback, stale-response protection, and a
clear uncertain state. Animate the established identity between row and shelf;
never report saved before confirmation. Measure the actual latency stages.

### UX-09 — Pinned shelf begins at the left · medium

**user-observed, screenshot-observed, code-confirmed.** Synthetic desktop/rail
captures show two pins aligned from the left edge. `chat/chat.css:106` wraps flex
items without center justification. Required outcome: a centered shelf for one,
two, and multiple pins, including incomplete rows, without changing saved order.
Search/hide/pin changes preserve focus and stable movement.

### UX-10 — Role title belongs next to the sidebar name · medium

**user-observed, code-confirmed.** `Rail.tsx:277` already renders a role chip
beside ordinary names when `role.title` exists; pin titles intentionally appear
below the avatar/name (`:248`). Missing title chips may be metadata absence,
truncation, or cascade effects; the owner's exact affected row is **unknown**.
`chat/chat.css:225` caps names and `:150` uses small 11px chip text.

Required outcome: ordinary rows show name plus genuine role title on one line;
long names/titles remain understandable in details and accessible names. Use
Main Pebble only for the verified primary role; never synthesize a job title
from a handle, description, or manager relationship. Missing titles can be
omitted until edited rather than filled with meaningless chips.

### UX-11 — Orchestrator terminology leaks into product and model copy · medium

**user-observed, code-confirmed.** `AgentAvatar.tsx:111` announces Orchestrator;
`WorkspaceSettings.tsx:142` and `:550` display it. The management skill
`plugins/bot-web/skills/manage-team/SKILL.md:6` and `:34` also uses it in prose.
Required outcome: **Main Pebble** throughout human-facing labels, tool descriptions,
skill instructions, prompt prose, approvals, errors, setup, and help. Keep stable
API/persistence identifiers compatible. Reporting and permission effects remain
real; the title conveys no new capability or permission.

### UX-12 — Details lacks desktop control and capability-backed tabs · high

**user-observed, screenshot-observed, code-confirmed.** `App.tsx:1281` always mounts
the desktop aside; `chat/chat.css:446` hides the details trigger until tablet.
`App.tsx:1124` uses an information icon and open-only behavior. `Inspector.tsx:33`
has no close control; `:49` always prints activity, usually Ready; `:55` is a
heading rather than a Routines tab. The synthetic screenshot shows the star
below/outside the visible avatar body; `AgentAvatar.tsx:110` overlays an HTML star
on the avatar wrapper, whose visible SVG body occupies less than the wrapper.

Required outcome: a small sliders icon toggles details at every size; close inside
panel; identity with attached Main Pebble badge; compact **Routines**, **Files**,
and capability-backed **Computer** tabs. Remove idle Ready and redundant text.
Keep approvals discoverable outside closed details. Preserve transcript anchor
through resize and gentle panel transition. Native Computer is conditional, not
a separate isolated machine for every pebble; see native capability evidence.

### UX-13 — Footer actions clutter daily navigation · medium

**user-observed, screenshot-observed, code-confirmed.** `Rail.tsx:340` exposes
connection, logout/disconnect, Settings, and Show hidden in two footer rows. The
reference account capture establishes a compact avatar-menu pattern, not an
entitlement to imitate its subscription, upsell, app, or account-switch actions.
Required outcome: an owner avatar/initial menu with actual Settings, Show hidden,
and Sign out actions; relevant connection failures remain visible outside it.
Use a neutral owner mark if no owner image/name exists; never use the Main Pebble
avatar as the owner's identity or invent account management.

### UX-14 — Latest-message movement is abrupt; motion is piecemeal · medium

**user-observed, code-confirmed, reproduced in synthetic Chrome.** `App.tsx:310` immediately assigns scrollTop and
hides the button; `chat/chat.css:1150` specifies auto scrolling. The browser probe
recorded scrollTop changing from 0 to the maximum 2544px by click completion. Buttons have 120ms
background/border transitions (`:25`) and reduced-motion overrides (`:1081`),
but drawers and identity movement have no cohesive motion contract.

Required outcome: a brief, cancellable, visibly smooth Latest messages scroll;
instant reduced-motion equivalent; stable behavior when content streams or the
reader intervenes. Automatic history restoration remains instant and stable.
Define menus, drawers, pins, hover, selection, loading, and status changes together.

### UX-15 — Composer cursor/focus and real attachments · high

**user-observed; cursor cause unknown/not reproduced in the tested state;
focus/attachment absence code-confirmed.** The reported
pointer cursor is not established by inspected CSS: `style.css:25` sets pointer
on buttons, and `chat/chat.css:615` does not set textarea cursor. Investigate
actual hovered element, overlay, disabled state, and computed styles in the
reported browser. Synthetic editable Chrome returned cursor=text and
elementFromPoint=TEXTAREA/text, so no pointer defect was reproduced in that state.
Computed outline was none. The textarea explicitly suppresses outline (`:626`), overriding
global focus; no composer focus-within replacement was found (**code-confirmed**).
`App.tsx:1227` offers only textarea and Send/Stop, with a 16,000-character limit.

Required outcome: text cursor across the editable hit area, caret and clear focus,
controls retain their own pointer/disabled state, and keyboard/IME behavior stays
correct. Attachment upload requires a real owner-local adapter, attachment refs,
limits, type validation, path/symlink protection, lifecycle and supported-native
capabilities. Existing avatar photo upload is not chat attachment support.

### UX-16 — Cross-cutting accessibility and resilience gaps · high

**code-confirmed with inferred impact; runtime compliance unknown.**

- Drawer (`chat/Drawer.tsx:14`) implements Escape, tab wrap, browser-back and focus
  restoration, but its selector omits select/summary and no background inerting
  is visible. Stacked overlays, removed triggers, mobile back, and programmatic
  focus escape need testing; do not call it fully accessible from this source.
- Transcript uses a log with `aria-live="off"` (`App.tsx:1154`); avoid repeated
  streaming announcements, but provide a separate concise completion/error/new
  activity announcement. Unread dots (`Rail.tsx:251`, `:296`, `:326`) lack a textual
  unread equivalent. Avatar motion must not be the sole status channel.
- 26px menu and 32px header controls need target-size/spacing review; 10–11px chip
  and timestamp text need readability review. Existing focus rules omit selects
  and links; composer removes focus. Token values alone do not establish contrast.
- Settings tab buttons use pressed semantics rather than a complete tab pattern;
  prefer navigation links when changing pages or proper tabs for local panels.
- Most forms use visible labels, but errors are usually page-level strings,
  without field association. Global busy state obscures which item is changing.
  RequestReview renders raw field keys/JSON (`:47`), reducing review clarity.
- No results, no data, loading, failure, stale, unavailable, and disconnected
  states need distinct copy and actions. Current search's no-results check
  (`Rail.tsx:336`) considers pebbles but not room matches (**inferred** inconsistent
  empty text when only a room matches).
- A fixed Latest button offset (`chat/chat.css:585`) may overlap a growing composer
  or approval nudge; test dynamic height, keyboard, safe area and zoom. Details
  reflow, long code/table content, and long names need anchor/overflow checks.

## Decision and verification boundaries

1. Resolve the Crew organization/native-chat naming relationship without silently
   migrating native state. The design system gives the conservative starter model.
2. Files/attachments/Computer are separate capability deliverables. Native support
   does not imply this bridge exposes it, every host supports it, or room chats
   support it. See the dedicated capability report and gates.
3. Extend the initial synthetic browser evidence before implementation:
   remaining menu edges, actual pin latency, the reported composer state, Settings
   edits across refresh, dialogs, 320/390/tablet/desktop, 200% text zoom, 400% reflow,
   real keyboard/screen-reader routes, contrast and reduced motion. No new user
   screenshots or external uploads are needed to start.
4. Run owner-local installer and both supported native-version flows before
   claiming completion. UI review, package release, and a particular owner's
   deployment remain separate states.
