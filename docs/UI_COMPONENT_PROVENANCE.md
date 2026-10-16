# UI foundation source and verification

This foundation replaces the proposed bespoke component layer. The current
production routes have **not** been migrated. The isolated reference is
`apps/web/ui-lab.html`; its data and responses are synthetic and it makes no
Hermes requests.

## Owned components

The component files in `apps/web/src/components/ui/` were installed from the
official [shadcn/ui registry](https://ui.shadcn.com/) on 2026-10-16 using its CLI,
New York style and the Radix implementation. They are actual registry source,
owned and editable in this repository. shadcn is not a runtime package. Its MIT
notice is retained in [licenses/shadcn-ui.txt](licenses/shadcn-ui.txt).

Installed components: Button, Input, Textarea, Label, Field, Checkbox, Switch,
Tabs, Dialog, AlertDialog, Sheet, DropdownMenu, Select, Tooltip, Command, Badge,
Card and Separator. `IconButton` is our small composition of Button and Tooltip,
with a required accessible label. Not every primitive needs to appear in the
interface; for example Separator is available without adding ornamental lines.

Local changes to the registry source establish the quiet action variant,
explicit transition properties, shared timing, flat dialog surfaces, larger
close targets and compact tab treatment. Future registry updates need diff
review; do not overwrite these files blindly.

| Layer                       | Installed version | Responsibility                                                |
| --------------------------- | ----------------- | ------------------------------------------------------------- |
| Radix (`radix-ui`)          | 1.8.1             | Focus, keyboard, portals, collision handling, modal ownership |
| Tailwind / Vite integration | 4.3.3             | Semantic theme utilities and generated CSS                    |
| Motion                      | 14.3.0            | Coordinated layout and presence transitions                   |
| Lucide React                | 1.58.0            | Consistent interface icons                                    |
| cmdk                        | 1.1.1             | Command/search list interaction                               |
| class-variance-authority    | 0.7.1             | Typed component variants                                      |
| cn                          | 0.5.0             | Registry class composition                                    |
| tw-animate-css              | 1.4.0             | Registry enter/exit utility animations                        |

Versions are pinned in the manifests and lockfile. Tokens and common control
treatment live in `apps/web/src/ui/foundation.css`. Production migration must
replace the legacy theme and controls, not append this stylesheet after them.

## Run the reference

```sh
npm ci
npm run dev:ui-review
```

Open `http://127.0.0.1:8094/ui-lab.html`. Search uses sample entities, messages,
files and routines; sending produces a labeled local sample response. Settings,
enrollment, attachments and photos exercise interface behavior without changing
Hermes or uploading files. These are design controls, not native integration
verification.

```sh
npm run check
npm run test:ui-review
```

The browser suite uses Playwright Chromium. Install that browser normally or set
`BOT_WEB_TEST_CHROMIUM` to an existing compatible executable. The reference build
goes to `artifacts/ui-reset/build`; the normal app build and release inputs do
not include it.

The reference entry is an evaluation surface, not the target production module
structure. During migration, use the ownership boundaries and state contracts
in [UI_SYSTEM_RESET.md](UI_SYSTEM_RESET.md), and complete the actual-route gates
in [UI_RESET_REVIEW_CHECKLIST.md](UI_RESET_REVIEW_CHECKLIST.md). A sample overlay
cannot pass the required owner-local historical search gate.
