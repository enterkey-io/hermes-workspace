import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const root = resolve(import.meta.dirname, '..');
const output = resolve(process.argv[2] ?? '.audit/agent-guards.json');
const directory = mkdtempSync(join(tmpdir(), 'pebble-guard-audit-'));
const checker = join(root, 'scripts/check-ui-contract.mjs');
const checks = [];
function checkUi(cwd, revision) {
  const run = spawnSync(process.execPath, [checker, ...(revision ? [revision] : [])], {
    cwd,
    encoding: 'utf8',
  });
  if (run.error || run.status === null) throw run.error ?? new Error('Checker did not finish');
  return { accepted: run.status === 0, diagnostics: (run.stdout + run.stderr).trim() };
}
function record(name, expected, observed, detail) {
  checks.push({ name, expected, observed, matches: expected === observed, detail });
}
try {
  record('current UI contract', true, checkUi(root).accepted, 'Baseline checker completes.');
  for (const revision of ['ac4a881', '47e50a3']) {
    const result = checkUi(root, revision);
    record(`historical UI contract ${revision}`, false, result.accepted, result.diagnostics);
  }
  cpSync(join(root, 'apps/web/src'), join(directory, 'apps/web/src'), { recursive: true });
  const newPebble = join(directory, 'apps/web/src/NewPebble.tsx');
  const original = readFileSync(newPebble, 'utf8');
  const omitted = original.replace(
    /<ReportingField\b[\s\S]*?\/>/,
    '{/* <ReportingField removed */}',
  );
  if (omitted === original) throw new Error('ReportingField probe no longer matches its target');
  writeFileSync(newPebble, omitted);
  record(
    'synthetic missing reporting control with a comment marker',
    true,
    checkUi(directory).accepted,
    'Demonstrates the text guard limit. This does not run or challenge the browser persistence test.',
  );
  const source = readFileSync(join(root, 'apps/web/src/workspace.ts'), 'utf8');
  const compiled = transpileModule(source, {
    compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2023 },
  }).outputText;
  const { workspaceState } = await import(
    'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
  );
  const malformed = {
    revision: 1,
    initialized: true,
    bots: [
      {
        profile: 'synthetic',
        handle: 'synthetic',
        appearance: 'invalid',
        role: 'invalid',
        manager: 7,
      },
    ],
    teams: [],
  };
  let acceptedMalformed = false;
  try {
    workspaceState(malformed);
    acceptedMalformed = true;
  } catch {}
  record(
    'malformed workspace accepted',
    true,
    acceptedMalformed,
    'Observed boundary gap. No claim that Hermes emitted this payload.',
  );
  const historicalPath = 'apps/web/src/ui-lab/main.tsx';
  const historical = execFileSync('git', ['show', `ac4a881:${historicalPath}`], {
    cwd: root,
    encoding: 'utf8',
  });
  record(
    'historical reference used a separate root',
    true,
    historical.includes('createRoot') && historical.includes('UiReview'),
    historicalPath,
  );
  const report = {
    baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    checks,
    verdict: checks.every((check) => check.matches)
      ? 'OBSERVATIONS_REPRODUCED'
      : 'OBSERVATIONS_CHANGED',
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!checks.every((check) => check.matches)) process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
