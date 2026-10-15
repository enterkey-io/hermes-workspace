// Local Workerd/D1 acceptance. No Cloudflare account or external services are used.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, jwtVerify, importJWK } from 'jose';
const directory = await mkdtemp(join(tmpdir(), 'workspace-worker-'));
const config = resolve('apps/owner-worker/wrangler.jsonc');
const cli = resolve('node_modules/wrangler/bin/wrangler.js');
const vars = resolve('apps/owner-worker/.dev.vars');
const previous = await readFile(vars).catch(() => null);
const origin = 'http://127.0.0.1:8095';
const proof = 'S'.repeat(43);
const pair = await generateKeyPair('EdDSA', { extractable: true });
const settings = {
  origin,
  bridgeUrl: 'http://127.0.0.1:8799',
  development: true,
  installationId: crypto.randomUUID(),
  keyId: 'fixture-key',
  authSecret: crypto.randomUUID() + crypto.randomUUID(),
  signingKey: await exportJWK(pair.privateKey),
};
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_SEND_METRICS: 'false' };
let server;
function run(args) {
  return execFileSync(process.execPath, [cli, ...args, '--config', config], { env, stdio: 'pipe' });
}
async function start() {
  server = spawn(
    process.execPath,
    [
      cli,
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      '8095',
      '--persist-to',
      directory,
      '--config',
      config,
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  server.stdout.on('data', (d) => {
    output += d;
  });
  server.stderr.on('data', (d) => {
    output += d;
  });
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error('Local worker exited: ' + output.slice(-3000));
    try {
      const r = await fetch(origin + '/api/instance/status');
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Worker failed to start: ' + output.slice(-3000));
}
async function stop() {
  if (!server) return;
  server.kill('SIGTERM');
  await new Promise((r) => server.once('exit', r));
  server = undefined;
}
async function call(path, body, cookie) {
  const r = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return r;
}
try {
  await writeFile(vars, "OWNER_SETTINGS='" + JSON.stringify(settings) + "'\n", { mode: 0o600 });
  run([
    'd1',
    'migrations',
    'apply',
    'hermes-workspace-owner',
    '--local',
    '--persist-to',
    directory,
  ]);
  const hash = createHash('sha256').update(proof).digest('hex');
  run([
    'd1',
    'execute',
    'hermes-workspace-owner',
    '--local',
    '--persist-to',
    directory,
    '--command',
    `INSERT INTO owner_setup VALUES(1,'${hash}',${Date.now() + 100000});`,
  ]);
  await start();
  const b = await call('/api/bootstrap', {
    proof,
    username: 'owner',
    password: 'synthetic-password-123',
  });
  assert.equal(b.status, 201, await b.text());
  const login = await call('/api/auth/sign-in/username', {
    username: 'owner',
    password: 'synthetic-password-123',
    rememberMe: true,
  });
  assert.equal(login.status, 200, await login.text());
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  assert(cookie);
  await stop();
  await start();
  const ticket = await call('/api/hermes/ticket', {}, cookie);
  assert.equal(ticket.status, 200, await ticket.clone().text());
  const payload = await ticket.json();
  const key = await importJWK(await exportJWK(pair.publicKey), 'EdDSA');
  await jwtVerify(payload.ticket, key, { issuer: origin, audience: settings.installationId });
  assert.equal((await call('/api/auth/sign-out', {}, cookie)).status, 200);
  assert.equal((await call('/api/hermes/ticket', {}, cookie)).status, 401);
  console.log(
    'Local Cloudflare Worker/D1: bootstrap, library password login, restart persistence, signed ticket and logout passed.',
  );
} finally {
  await stop();
  if (previous) await writeFile(vars, previous);
  else await rm(vars, { force: true });
  await rm(directory, { recursive: true, force: true });
}
