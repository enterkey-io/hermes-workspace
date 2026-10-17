# Pebble Crew implementation rules

This is a self-hosted interface to real Hermes Bot Mode. Keep owner data and
credentials on the owner's infrastructure. Install/update checks must not run
models or change owner personas. Use isolated synthetic homes and a local model
for native acceptance.

| Recurring failure                                        | Structural enforcement                                                                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A polished mockup differs from the installed screens     | `ui-lab/main.tsx` imports the actual app entry. `npm run check:ui` rejects a separate review app or theme graph. Review the installed routes.                                                             |
| Global CSS silently overrides shadcn/Radix states        | One `ui/theme.css` entry, layered foundation focus rules, primitive-owned states. `check:ui` rejects the historical global product focus override.                                                        |
| Add/Edit lose name, avatar or role controls              | Use `PebbleProfileFields` in all profile flows. `check:ui` enforces reuse; browser/native tests verify persistence, including photo → shape → saved photo.                                                |
| Sections mix crews with pebbles or empty headings appear | Built-in section IDs have fixed names and allowed item kinds in both organization domains. Empty built-ins are omitted; custom sections remain drop targets. Domain and browser checks cover these rules. |
| Handles and reorder menu clutter return                  | Whole rows/tiles/section headers drag; keyboard reordering uses Alt+Arrow. `check:ui` rejects exposed grip controls and reorder menu items.                                                               |
| UI tests pass while real agent setup fails               | The `native-owner` CI job runs the actual owner app and bridge against pinned Hermes in a disposable home. Do not substitute mock-only checks for this gate.                                              |
| Mobile fixes pass checks but text is still misaligned   | Phone browser checks compare the composer field and send-control centers, not just viewport containment. Inspect the settled iPhone and Android screenshots. |
| Committed replies pop or duplicate a live turn          | `SendProjection` preserves displayed timestamps. Reaction events update addressed rows directly; polling cannot replace the transcript during a live turn. Browser checks exercise reaction arrival during streaming and stable touch controls at completion. |
| A model is told to use a tool it cannot discover        | Reaction guidance checks the native enabled definitions. Native acceptance describes the deferred schema before invoking it, with catalog listings disabled and an existing saved tool selection, on both supported Hermes builds. |
| Reaction decoration or misplaced mobile menus return | Browser checks assert transparent, borderless and shadowless reactions in normal/selected/hover states, and 44-pixel sidebar menu buttons aligned to row/tile edges on iPhone and Android. Inspect their settled screenshots. |
| Connections fixtures conceal impossible service states | Use separate OAuth and API-key services. Browser checks cover sign-in refresh, failed key receipts, preservation of unsaved tool edits, guarded navigation and fixed outer scroll position. |

For UI changes, run `npm run check`, the relevant production browser flows, and
inspect settled desktop/phone screenshots. Use the native owner check when a
profile, avatar, setup or chat contract changes. Tests establish the exercised
behavior, not owner visual acceptance or every platform's performance.

Keep copy short. UI selection/focus uses the neutral theme; avatar colors are
independent. No external design/source upload without the owner's authorization.
