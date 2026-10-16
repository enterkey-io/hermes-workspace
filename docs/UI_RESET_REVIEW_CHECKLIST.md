# UI reset independent review

Status: **prototype foundation direction accepted within the observations below; production migration not reviewed**. This file is an executable acceptance record, not a declaration of completion. Reviewer must be independent of the production implementer and inspect the actual built UI. Reference contract: [UI_SYSTEM_RESET.md](UI_SYSTEM_RESET.md).

## Record before reviewing

- Build commit / dirty diff hash:
- Served build command and URL:
- Reviewer / implementer:
- Browser/version, OS, DPR, hardware:
- Fixture source: synthetic only; no private owner data:
- Installed shadcn registry/base, Radix, Motion, Lucide versions:
- Evidence directory:
- Final verdict: pending / changes required / accepted within stated scope:
- Unverified native or platform boundaries:

Do not mark a box from source or automated test output alone when it requires a visual/interactive observation. Save a screenshot for static results and a short video or timestamped frames for motion. Include both resting and focused/hovered/pending states. Record failures as concrete observations with severity, route, viewport, reproduction and evidence path. A missing scenario remains unchecked.

## Fixture and viewport matrix

- [ ] 1920×1080 and1440×900 desktop: rail/main/details, long text, two pins, Main Pebble badge,12+ rows, two Crews and distinct Group chat.
- [ ] 1280×800 boundary and1279×800: details changes correctly between reserved desktop column and modal sheet.
- [ ] 1024×768 and768×1024 tablet: menu collisions, sheet focus, lists and composer.
- [ ] 390×844 and320×568 phone: keyboard/visualViewport resize, long editor, safe area,44px targets and no horizontal page overflow.
- [ ] 200% browser zoom; keyboard-only; reduced motion; forced colors; touch emulation.
- [ ] Normal,3s and10s network acknowledgement; disconnected stream, upload failure, partial enrollment, native rejection and uncertain mutation outcome.
- [ ] Empty history/roster,100-result picker, long names/role/filename, markdown code/table/image growth, older-history pagination.

## Every reported defect

| ID                    | Reproduction and acceptance                                                                                                                                                                                                                                                  | Result/evidence |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| R01 Settings          | Open Account, Connections and Requests. Shared controls, compact underline tabs, consistent field width/label rhythm, no nested border pile. Resize phone; footer actions reachable. Dirty edit survives background refresh, validation and reconnect.                       | Pending         |
| R02 Add existing      | Open from New pebble, filter100 synthetic profiles, choose items, change filter, scroll to bottom. One scrolling results region, fixed reachable actions, no transcript wrapper geometry. Added/loading/empty/error/partial outcomes are clear and concise.                  | Pending         |
| R03 Row overflow      | Hover/focus long-name row at every viewport. Trigger has dedicated right column, does not touch text/role/preview. Open menu near bottom and right edges; anchored placement, collision handling, Escape/focus return.                                                       | Pending         |
| R04 Pinned overflow   | Hover/focus each tile. Trigger is in its own action strip, never over face or Main Pebble badge. Pin/unpin and failure/reversal preserve selected identity and keyboard route.                                                                                               | Pending         |
| R05 Search geometry   | Measure rail toolbar/list top before/after Search and Cmd/Ctrl+K. Rectangles unchanged within1px. Search is overlay; Escape/Back closes and restores focus. No hidden rail filter remains.                                                                                   | Pending         |
| R06 Search scope      | Find a known loaded message phrase absent from names, routine, file name, Crew and Group chat. Correct types/context/selection. Coverage says loaded/incomplete. File contents/older history are never falsely reported searched. No query-triggered bot.open/read mutation. | Pending         |
| R07 Send entry        | Send while at bottom and while reading, short/multiline/file-only. At3s/10s delay: bubble arrives smoothly once, composer shrink coordinated, immediate metadata lane. Scroll can interrupt. Native acknowledgement does not remount, duplicate, jump or replay entrance.    | Pending         |
| R08 Timestamp         | Capture0/60/160/3000ms and acknowledgement. Submitted time exists from first frame in fixed20px lane; no floating delayed timestamp/date insertion. Authoritative correction preserves anchor. Missing native time stays honest.                                             | Pending         |
| R09 Copy              | Copy is icon, separate from time, with accessible name/tooltip; no word “Copy” clutter in message metadata. Works keyboard/touch; copied/error state occupies same target.                                                                                                   | Pending         |
| R10 Attachments       | Plus opens File and Photo menu above composer. Pick/cancel/reselect/paste/drop supported file. Preview/status/remove/retry clear, errors bounded. Switch chat during upload; file stays with originating draft/session. No unsupported vision promise.                       | Pending         |
| R11 Details tabs      | Routines/Files/conditional Computer are compact equal-width underline tabs. No fat rounded pill, unequal divider or unwanted baseline. Keyboard arrows and focus correct; capability changes cannot leave an empty selected panel.                                           | Pending         |
| R12 Section lines     | Inspect shell, rail footer, inspector, Settings and dialogs. Remove ornamental section separators and nested outlines; only major region/field/destructive boundaries remain. Whitespace establishes hierarchy.                                                              | Pending         |
| R13 Details opening   | Record frames across240ms. Panel physically enters reserved space and main/header/composer boundary moves with it. No overlay-only animation or text scale distortion. Reading message stays within2px of anchor (except deliberate scrolling).                              | Pending         |
| R14 Details closing   | Same frame capture in reverse. Main does not snap wider while panel fades. Close/open reversal at80ms remains continuous. Resize across breakpoint mid-transition: one panel, one focus owner, no stale width.                                                               | Pending         |
| R15 Avatar rest       | All shapes/sizes: resting pose visibly up/right with asymmetric eye projection, body/head response, legible Main Pebble badge. Photos unchanged. Human visual check required.                                                                                                | Pending         |
| R16 Avatar travel     | Traverse full left/right/up/down interaction region and diagonals. Both directions reach intended range; near eye larger/longer, far eye smaller, up/down shortens/tilts. No clipping/crossed eyes/snap on leave or state interruption.                                      | Pending         |
| R17 Avatar smoothness | Record pointer movement + rest transition; no stepped gaze.100 mounted/20 visible performance trace, offscreen/hidden parking,50 mount/unmount cycles, reduced motion static. Report measured p95 with hardware and sample window.                                           | Pending         |

## Foundation and authority checks

- [ ] Production routes import actual generated/owned shadcn Radix components. Their provenance and lockfile dependencies are present. No bespoke menu/focus trap remains behind a familiar component name.
- [ ] One theme styles main app, Settings, setup/login, nested dialogs, tooltips and portals. Same state/size variants; Lucide icons consistent.
- [ ] Duplicate legacy CSS and manual details timeout/FLIP are removed. No extra late override sheet or pervasive `!important` patch remains.
- [ ] Menu/Dialog/Sheet/Select keyboard behavior includes Escape, Tab, Shift+Tab, roving keys, focus return, scroll lock and nested popup ownership. Top overlay Back closes only that overlay with dirty guard honored.
- [ ] No nested buttons; names on all icon controls; visible focus; accessible contrast measured on actual surfaces; live status does not announce every streamed token.
- [ ] Native profile/session/room IDs, personalities, history, drafts, capability checks and approval fingerprints remain unchanged by presentation migration.
- [ ] Crew organization remains distinct from native Group chat participants/history. Main Pebble badge does not imply extra authority.
- [ ] Search permission/coverage/generation boundaries verified. Search does not advance native read/event cursors, enroll a profile, start a job or fetch arbitrary host paths.
- [ ] Required global search is tested against all authorized native profiles, including a never-opened-in-this-browser chat and older history beyond the currently loaded page. Known message phrase, routine and supported file-content queries return correct hits. Unsupported file types explicitly report filename-only coverage. A loaded-data Phase1 implementation cannot pass this full completion gate.
- [ ] Revocation/deletion/profile-incarnation changes remove inaccessible results; stale cursor/query generations cannot leak or select prior results. File extraction is bounded and owner-local; no secret or arbitrary-path indexing.
- [ ] Confirmed versus rejected versus uncertain send/file/pin/routine outcomes are distinct. No success before evidence, no blind retry of uncertain side effects.
- [ ] Safe markdown/download/computer lease behavior remains intact; content cannot widen page. Native attachment limits and capability conditions preserved.
- [ ] Production build/typecheck/targeted tests pass. These checks supplement the above observations and do not replace them.

## Review outcome

### Blocking findings

Independent prototype pass1,2026-10-16: actual `ui-lab.html` at localhost8094, dirty `codex/ui-system-reset` development reference, Chrome through CUA, observed1200×829 then1440×900 and320×568. Implementer was parent; reviewer was the separate architect. Synthetic data only. This pass did not verify the production migration or native backend. Browser automation lost its tab attachment during a later resize, so subsequent observations used the implementer's saved settled captures; each corrected finding below records the later explicit recheck in a freshly attached browser tab.

| Finding                                 | Reproduction/evidence                                                                                                                                                                                              | Status                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| P1 Details sheet partly offscreen       | At1200×829, open details: visual panel roughly x720–1040,y−414–414; heading/avatar/tabs offscreen. CSS reset of transform does not remove Tailwind individual translate. Live CUA screenshot in review transcript. | Corrected; independent live1200×829 recheck shows full-height right sheet and reachable Files tab        |
| P1 Responsive overlay steals focus      | Open Add existing with desktop details enabled, then resize1440→320. Details mounts above picker and takes focus. Live CUA AX switches to Arlo details while picker remains behind.                                | Corrected; independent1440→320 resize retains picker topmost and search focus                            |
| P2 Picker identity changes on filtering | Indigo secondary role says Operations in full list, Research after searching Indigo. Selection count survives correctly. Likely filtered-index fixture presentation.                                               | Corrected; independent filtering recheck retains Indigo Operations and appearance                        |
| P2 Rest gaze still too frontal          | 56px pin and88px details avatar at1440 show near-vertical capsules and weak apparent perspective.                                                                                                                  | Corrected direction observed at56/88px; all-shape extrema and performance remain unverified              |
| P2 Header Main Pebble badge distorted   | Small header avatar in desktop/phone captures has a narrow tall gold mark rather than round badge.                                                                                                                 | Corrected round badge observed in live header after update                                               |
| P2 Search focus return                  | After Search Escape and completed exit, DOM shows active BODY and zero dialogs; original trigger is not restored.                                                                                                  | Corrected; independent settled DOM recheck confirms active BUTTON named Search Pebble Crew, zero dialogs |

Follow-up compact-sheet check: the implementer identified a further Escape issue in which initial focus on the Close icon opened its tooltip, so the first Escape dismissed only that tooltip. Source now focuses the selected details tab on open and restores the toggle through `onCloseAutoFocus` after exit. Independent live recheck at 1200×829 observed Routines focused on entry; one Escape then completed sheet exit with zero dialogs/tooltips and focus on the “Show details” button. The immediate exit frame still contains the retained dialog, as expected; verification used the settled state. This correction does not substitute for the remaining nested-popup and production keyboard matrix.

### Accepted observations and evidence

- Search overlay uses a bounded, clear result hierarchy and visibly preserves the rail geometry. Sample results are identified; no native-search completion inferred.
- Add existing dialog has a clear header, bounded list and reachable footer; selected item count survives filtering. Parent capture `artifacts/ui-reset/reference/existing.png` and live CUA walkthrough.
- Updated main-page Settings and editor compositions are substantially clearer than baseline: flat field hierarchy, underline navigation, restrained actions. Evidence `artifacts/ui-reset/reference/settings.png` and `editor.png`; these show synthetic controls, not real account behavior.
- Parent's settled `checks.json` reports empty axe violation arrays for chat/search/settings/existing/editor/phone and no runtime errors. This is supporting tool output, not independent full accessibility certification.
- Desktop pin action strip no longer occupies the face region in live1440px view. Long-name and coarse-pointer overlap cases remain to test.
- Independent analysis of the implementer’s `artifacts/ui-reset/reference/shell-motion.json`: 42 close and 43 open samples, including 22 and 24 intermediate widths. Every sampled frame has `panel.left == main.right` and `main.right + reservedWidth == 1440`, with zero measured error; endpoints are 320px and 0px in both directions. This supports the shared geometry contract. The largest adjacent close-sample change is 130.34px, so this trace does not establish frame smoothness or performance. Rapid reversal, breakpoint interruption and transcript read-anchor preservation remain unchecked.
- Scoped verdict: proceed with this actual shadcn/Radix, Motion and shared-theme foundation into the staged production migration. This accepts the observed reference direction and corrected interactions, not all component states, all avatar shapes or native behavior. Keep the R01–R17 production gates open until the real migrated routes are reviewed.

### Captured avatar atlas review

Independent visual inspection of `artifacts/ui-reset/reference/avatar-projection-atlas.png`, 2026-10-16: five shapes (pebble, beacon, petal, kite, arch), each at rest and eight pointer directions. Captured gaze directions are distinguishable and follow the labels; resting poses read up/right. Left/right poses visibly reverse the near/far eye size relationship, and vertical/diagonal poses change face position and capsule tilt. No visible eye crossing or silhouette clipping was found in the captured open-eye poses. Petal and kite have tighter edge clearance at horizontal extremes but remain visibly contained in this atlas. Beacon up-left is captured during a blink, as identified by the implementer; it cannot establish that pose’s open-eye clearance.

Verdict: no new blocking visual defect for the foundation reference in this atlas. This adds static pose evidence only. It does not establish interpolation quality, every production avatar size, expression/blink combinations, reduced-motion behavior, scheduler performance or native integration. R15–R17 remain production gates; verify Beacon up-left with eyes open when completing the full pose/size matrix.

### Scope remaining

Global owner-local historical/file-content search requires the Phase2 capability and permission gate and remains required work for completion. Accurately disclosed loaded-data coverage is acceptable only as a staged milestone/prototype. Real native installation, Computer desktop startup or owner data behavior cannot be inferred from a synthetic UI fixture.

Approval requires every reported issue to have an observed result or a plainly stated unresolved boundary. A design canvas, static prototype, screenshot collection or passing test suite alone cannot establish that the product is finished.
