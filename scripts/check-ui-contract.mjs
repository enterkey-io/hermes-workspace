import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = process.argv[2];
const errors = [];
function read(path) {
  try {
    return revision
      ? execFileSync('git', ['show', `${revision}:${path}`], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        })
      : readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
function requireRule(condition, message) {
  if (!condition) errors.push(message);
}
const main = read('apps/web/src/main.tsx');
const review = read('apps/web/src/ui-lab/main.tsx');
const theme = read('apps/web/src/ui/theme.css');
requireRule(main.includes("import './ui/theme.css'"), 'The installed app must load ui/theme.css.');
requireRule(
  /import ['"]\.\.\/main['"]/.test(review) && !/createRoot|UiReview|\.css['"]/.test(review),
  'The review entry must reuse the installed app entry; do not build a second set of review screens.',
);
for (const sheet of ['foundation', 'layout', 'product']) {
  requireRule(theme.includes(`./${sheet}.css`), `The shared theme must include ${sheet}.css.`);
}
requireRule(
  !/^\s*:focus-visible\s*[{,]/m.test(read('apps/web/src/ui/product.css')),
  'Global focus rules belong in the base layer in foundation.css; product.css must not override primitive focus styles.',
);
const rail = read('apps/web/src/ui/OrganizationRail.tsx') + read('apps/web/src/chat/Rail.tsx');
requireRule(
  !read('apps/web/src/ui/layout.css').includes('#8e859d'),
  'Composer focus must use the neutral --ring token, not the old hard-coded lavender.',
);
requireRule(
  !/GripVertical|pc-section-empty|label: ['"]Move (?:up|down|earlier)['"]/.test(rail),
  'Drag whole rows; do not reintroduce exposed handles, empty-section instructions, or reorder menu clutter.',
);
for (const path of ['NewPebble.tsx', 'ExistingPebbleSetup.tsx', 'PebbleEditor.tsx']) {
  requireRule(
    read(`apps/web/src/${path}`).includes('PebbleProfileFields'),
    `${path} must use shared profile fields so name, avatar, title and description cannot diverge.`,
  );
  requireRule(
    /<ReportingField\b/.test(read(`apps/web/src/${path}`)) &&
      /<RoleDetails\b/.test(read(`apps/web/src/${path}`)),
    `${path} must expose shared reporting and detailed role controls.`,
  );
}
if (errors.length) {
  for (const message of errors) console.error(`UI contract: ${message}`);
  process.exitCode = 1;
} else
  console.log(
    'UI contracts passed: one app, one theme, shared profile forms and whole-row interaction.',
  );
