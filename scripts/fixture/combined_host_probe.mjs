// Research only: current owner app and real native bridge behind one loopback TLS URL.
// No production deployment, plugin packaging, or supervisor implementation is performed.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createNetServer } from 'node:net';
import { createServer as createTlsServer } from 'node:https';
import { request } from 'node:http';
import { chromium, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 30000 });

const directory = await mkdtemp(join(tmpdir(), 'workspace-combined-research-'));
const state = join(directory, 'owner');
const source = process.env.HERMES_NATIVE_ROOT ?? '/private/tmp/hermes-af0-source';
const python = process.env.HERMES_NATIVE_PYTHON ?? '/private/tmp/hermes-af0-py314/bin/python';
const children = [];
let browser, front, authority, origin, page;
const failedResponses = [];
const result = {
  source_revision: execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  checks: {},
};
async function unusedPort() {
  const socket = createNetServer();
  await new Promise((r) => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  return port;
}
function start(command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  child.stdout.on('data', (x) => (diagnostic += x));
  child.stderr.on('data', (x) => (diagnostic += x));
  children.push({ child, diagnostic: () => diagnostic });
  return child;
}
async function ready(port, path, status) {
  let lastStatus;
  for (let i = 0; i < 300; i++) {
    if (children.some(({ child }) => child.exitCode !== null))
      throw new Error('A fixture process exited');
    lastStatus = await localRequest(port, path);
    if (lastStatus === status) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Disposable readiness timed out for ${path} (last status ${lastStatus})`);
}
function localRequest(port, path, method = 'GET', extraHeaders = {}) {
  return new Promise((resolve) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { Host: authority, Origin: origin, ...extraHeaders },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    req.on('error', () => resolve(0));
    req.end();
  });
}
const [ownerPort, bridgePort] = await Promise.all([unusedPort(), unusedPort()]);
try {
  const key = join(directory, 'key.pem'),
    cert = join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' },
  );
  front = createTlsServer(
    { key: await readFile(key), cert: await readFile(cert) },
    (incoming, outgoing) => {
      if (incoming.headers.host !== authority) return outgoing.writeHead(403).end();
      const port = incoming.url.startsWith('/v1/') ? bridgePort : ownerPort;
      const upstream = request(
        {
          hostname: '127.0.0.1',
          port,
          path: incoming.url,
          method: incoming.method,
          headers: incoming.headers,
        },
        (response) => {
          outgoing.writeHead(response.statusCode, response.headers);
          outgoing.flushHeaders();
          response.pipe(outgoing);
        },
      );
      upstream.on('error', () => {
        if (!outgoing.headersSent) outgoing.writeHead(502);
        outgoing.end();
      });
      outgoing.on('close', () => upstream.destroy());
      incoming.pipe(upstream);
    },
  );
  await new Promise((r) => front.listen(0, '127.0.0.1', r));
  authority = `127.0.0.1:${front.address().port}`;
  origin = `https://${authority}`;
  execFileSync(
    process.execPath,
    [
      'apps/owner-node/dist/main.mjs',
      'init',
      '--origin',
      origin,
      '--bridge',
      origin,
      '--state',
      state,
    ],
    { stdio: 'pipe' },
  );
  const ownerArgs = [
    'apps/owner-node/dist/main.mjs',
    'serve',
    '--state',
    state,
    '--port',
    String(ownerPort),
  ];
  let owner = start(process.execPath, ownerArgs);
  const bridgeArgs = [
    'scripts/fixture/native_smoke.py',
    '--serve',
    '--port',
    String(bridgePort),
    '--origin',
    origin,
    '--public-host',
    authority,
    '--owner-trust',
    join(state, 'trust.json'),
    '--short-leases',
  ];
  start(python, bridgeArgs, { PYTHONPATH: source });
  await ready(ownerPort, '/api/instance/status', 200);
  await ready(bridgePort, '/v1/connect', 401);
  browser = await chromium.launch(
    process.env.BOT_WEB_TEST_CHROMIUM ? { executablePath: process.env.BOT_WEB_TEST_CHROMIUM } : {},
  );
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  const requests = new Set(),
    errors = [];
  page.on('request', (r) => requests.add(new URL(r.url()).origin));
  page.on('response', (r) => {
    if (r.status() >= 400)
      failedResponses.push({ path: new URL(r.url()).pathname, status: r.status() });
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await expect(page.getByRole('heading', { name: 'Create your login' })).toBeVisible();
  const proof = (await readFile(join(state, 'setup-code.txt'), 'utf8')).trim();
  await page.getByLabel('Private setup code').fill(proof);
  await page.getByLabel('Username', { exact: true }).fill('fixture_owner');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-research-password-123');
  await page.getByLabel('Confirm password').fill('synthetic-research-password-123');
  await page.getByRole('button', { name: 'Create login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Set up your agent' })).toBeVisible();
  result.checks.first_use_owner_setup_then_native_onboarding = true;
  result.checks.no_connect_address_or_pairing_form =
    (await page.getByRole('button', { name: 'Connect my Hermes', exact: true }).count()) === 0;
  await page.getByRole('checkbox', { name: 'Send an introduction' }).uncheck();
  await page.locator('.handle-input input').fill('aurora');
  await page.getByRole('button', { name: 'Start chatting', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  result.checks.native_primary_enrolled_through_same_url = true;
  await page
    .getByLabel('Message', { exact: true })
    .fill('Disposable same-origin native Bot Mode check');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Native fixture reply', { exact: true }).last()).toBeVisible();
  result.checks.real_native_bot_mode_synthetic_model_reply = true;
  await page.waitForTimeout(2200);
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  result.checks.stream_survives_accelerated_idle_lease = true;
  const session = (await context.cookies()).find((c) => c.name.includes('session_token'));
  result.checks.secure_httponly_strict_session =
    !!session?.secure && !!session?.httpOnly && session?.sameSite === 'Strict';
  await page.getByLabel('Message', { exact: true }).fill('Unsent draft after restart');
  // The native_smoke fixture owns its ephemeral Hermes home, so restart only its native
  // gateway via the fixture control, retaining that home and all stores.
  const restart = await page.request.post(`${origin}/fixture/restart-native`, {
    headers: { Origin: origin, Authorization: 'Bearer ' + 'f'.repeat(43) },
  });
  // The deliberately narrow front door doesn't route fixture-only controls.
  result.checks.fixture_controls_not_exposed_at_owner_front_door = restart.status() === 404;
  const nativeRestart = await localRequest(bridgePort, '/fixture/restart-native', 'POST', {
    Authorization: 'Bearer ' + 'f'.repeat(43),
  });
  if (nativeRestart !== 200) throw new Error('Synthetic native gateway restart failed');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
    'Unsent draft after restart',
  );
  result.checks.native_gateway_restart_preserves_draft = true;
  owner.kill('SIGTERM');
  await new Promise((r) => owner.once('exit', r));
  // ready() ignores intentionally stopped children after removing their tracked entry.
  children.splice(
    children.findIndex((p) => p.child === owner),
    1,
  );
  owner = start(process.execPath, ownerArgs);
  await ready(ownerPort, '/api/instance/status', 200);
  await page.reload();
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  result.checks.owner_service_restart_and_reload_need_no_repairing = true;
  result.checks.browser_uses_only_one_origin = requests.size === 1 && requests.has(origin);
  result.checks.no_page_errors = errors.length === 0;
  result.passed = Object.values(result.checks).every(Boolean);
  const output = process.argv[2];
  if (output) await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  console.error(
    JSON.stringify({ failedResponses, headings: await page?.locator('h1').allTextContents() }),
  );
  // The fixture stores no real content or credentials; omit HTTP bodies and state files.
  console.error(children.map(({ diagnostic }) => diagnostic().slice(-1000)).join('\n'));
  process.exitCode = 1;
} finally {
  await browser?.close();
  front?.closeAllConnections();
  if (front?.listening) await new Promise((r) => front.close(r));
  for (const { child } of children) if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.all(
    children.map(({ child }) =>
      child.exitCode === null ? new Promise((r) => child.once('exit', r)) : undefined,
    ),
  );
  await rm(directory, { recursive: true, force: true });
}
