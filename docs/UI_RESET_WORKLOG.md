# UI foundation reset

This work follows the owner's rejection of the 0.6 preview's interface. Passing
the previous checks did not establish product quality. Do not treat its design
system or implemented backlog labels as acceptance of the current experience.

## Work sequence

- [x] Ground: confirm the current framework, custom controls and overlapping CSS.
- [x] Ground: review the actual rendered baseline and trace every owner report.
- [x] Sketch: Astra-high compares component foundations and defines complete
      component, layout, interaction, motion and avatar contracts.
- [x] Reference: compare the alternatives against the owner's requirements and build
      a concrete interactive reference using the selected real component base.
- [ ] Implement: migrate production screens in independently reviewable units;
      remove the replaced controls and CSS rules in each unit.
- [ ] Scrap: reject any sketch whose implementation needs repeated layout or
      state workarounds; do not layer overrides onto that sketch.
- [ ] Independent review: exercise the completed build after implementation,
      including slow responses, failures, keyboard use and multiple viewports.
- [ ] Release: publish only after that review's findings are resolved and checked.

The owner requested a fresh **gpt-6-astra / high** reviewer. That reviewer owns
`UI_SYSTEM_RESET.md` and `UI_RESET_REVIEW_CHECKLIST.md`; the implementation is
owned by the main agent. No owner-host update is implied by this branch.

## Completed reference work

- Actual shadcn/Radix source installed, with Tailwind, Lucide and Motion. See
  [UI_COMPONENT_PROVENANCE.md](UI_COMPONENT_PROVENANCE.md).
- Isolated interactive reference covers the shell, pinned and regular actions,
  sample search, Settings, Add existing, editor, attachments and details.
- Pure avatar projection and shared renderer changes cover up/right rest,
  bidirectional pointer travel, near/far eye perspective and reduced motion.
- Independent Astra browser review found and rechecked compact sheet placement,
  overlay ownership during resize, picker identity, search focus return and
  the Main Pebble badge. The all-shape atlas received a separate static check.
- Production migration, real owner-local search, complete motion/performance
  and native integration acceptance remain open. No new release is implied.

Local synthetic evidence is under `artifacts/ui-reset/`: baseline/reference
captures, per-frame shell geometry, avatar atlas and check logs. Evidence is
excluded from Git and contains no owner conversations or credentials.

## Verification of this branch

- `npm run check`: type checks, lint, formatting, 81 unit tests and normal builds passed.
- Built reference browser checks: 7 passed.
- Existing chat browser checks: 13 passed; the avatar check initially measured
  scaled CSS coordinates against viewBox thresholds. Correcting that measurement
  to SVG-local coordinates and rerunning the affected case passed.
- Avatar lab browser checks: 6 passed, including photo, reduced motion and disposal.
- Settled axe scans: no reported violations in chat, search, Settings, Add
  existing, editor or phone reference states. This is not a full accessibility audit.
- Tailnet HTTPS preview: 200, no page errors or failed browser requests in the
  checked conversation, search and Settings interactions.

The optional external design-canvas upload was blocked by automatic approval
review. No source was uploaded; the reference and evidence remain local. This
does not block the local design review or its production migration plan.

## Follow-up reference refinement

The owner found the general direction better and specified persistent integrated
details, a stationary editor, one header toggle, Crew chats, custom sections,
balanced avatar attention, dark menus, quieter scrollbars and minimal activity.
The reference now includes these. Sections/Crews and their move/reorder operations
have a separate typed model and component. New local Crew conversations keep
their own messages and drafts. Native group-chat binding, permissions, durable
organization state and activity event mapping remain production work.

Keep the title unchanged. No source is to be exported to Superdesign; the owner
explicitly chose the local workflow. High-level other-runtime feasibility is a
separate step after publishing this reference update.

Follow-up verification: full check/build passed; the latest unit run passed86 tests after adding the pinned-row ordering regression. The revised
reference suite passed15 cases; a further focused draft/attachment conversation
scope check passed after scoping those values by conversation (16 cases total).
The existing chat suite passed14 and avatar lab passed6. Local visual inspection
covered docked1200px layout, stationary Profile/Role editor, dark account menu,
Thinking/Working labels, full-width phone details and phone return to chat.
The shared activity line was observed during its real CSS shimmer, including
static reduced motion; this verifies the reference, not native run-event mapping.
