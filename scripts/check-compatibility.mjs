import { readFile } from 'node:fs/promises';
import { assessBotMode } from '../packages/hermes-client/dist/hermes-client.js';

const report = JSON.parse(await readFile('docs/compatibility/integration-evidence.json', 'utf8'));
const assessed = assessBotMode({
  revision: report.revision,
  topology: report.topology,
  gates: report.gates ?? {},
});
if (report.evidenceLevel !== 'browser-pass' || !assessed.certified) {
  process.stderr.write(
    'BLOCKED: hosted Bot Mode is not certified. See docs/compatibility/matrix.md.\n',
  );
  process.exitCode = 1;
}
