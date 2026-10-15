import { readFile } from 'node:fs/promises';
import { assessBotMode } from '../packages/hermes-client/dist/hermes-client.js';

const report = JSON.parse(await readFile('docs/compatibility/integration-evidence.json', 'utf8'));
const assessed = assessBotMode({
  revision: report.revision,
  topology: report.topology,
  transport: report.transport,
  gates: report.gates ?? {},
});
const installation = JSON.parse(
  await readFile('docs/compatibility/installation-evidence.json', 'utf8'),
);
const installationGates = [
  'single-installation-agent',
  'owner-admin-bootstrap-and-login',
  'fresh-native-bot-setup',
  'existing-agent-selection-and-identity',
  'idempotent-existing-install',
  'single-origin-plugin-trusted-tls',
  'owner-first-use-without-server-configuration',
  'reopen-and-reconnect-without-agent',
  'restart-recovery',
  'installed-update-and-rollback',
  'privacy-and-probe-isolation',
];
if (report.evidenceLevel !== 'browser-pass' || !assessed.certified) {
  process.stderr.write(
    'BLOCKED: hosted Bot Mode is not certified. See docs/compatibility/matrix.md.\n',
  );
  process.exitCode = 1;
}
if (
  installation.evidenceLevel !== 'launch-pass' ||
  !installationGates.every((gate) => installation.gates?.[gate] === 'pass')
) {
  process.stderr.write(
    'BLOCKED: one-agent installation and owner first-use are not certified. See docs/INSTALLATION_CONTRACT.md.\n',
  );
  process.exitCode = 1;
}
