import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const source = process.argv[2];
if (!source) {
  throw new Error('Usage: npm run compatibility:audit -- /path/to/hermes-source');
}
const revisions = [
  '29112bef099274229cadff79cdff7bf7b99c4b77',
  '1fd18277267152893a8a24792b79213e7ca3f899',
  '53df274b08f2bbbe82bb67bb50c7571952e95809',
];
const paths = [
  'hermes_cli/web_server.py',
  'hermes_cli/dashboard_auth/routes.py',
  'tui_gateway/methods_profiles.py',
  'tui_gateway/methods_groups.py',
  'tools/bot_mode_dm.py',
];
const evidence = revisions.map((revision) => {
  const content = paths.map((path) =>
    execFileSync('git', ['show', `${revision}:${path}`], {
      cwd: source,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    }),
  );
  const [server, auth, profiles, groups, teammate] = content;
  return {
    revision,
    evidenceLevel: 'source-only',
    checks: {
      dashboardCorsRestrictedToLoopback: server.includes(
        'allow_origin_regex=r"^https?://(localhost|127',
      ),
      websocketTicketRequiresSession: auth.includes('getattr(request.state, "session", None)'),
      nativeAuthorizeUsesLoopbackRedirect: auth.includes(
        '_validate_loopback_redirect_uri(redirect_uri)',
      ),
      managedProfilesRpc: profiles.includes('"profiles.list"') && profiles.includes('ui_meta'),
      nativeGroupRpc: groups.includes('"groups.list"') && groups.includes('"groups.send"'),
      nativeTeammateTool: teammate.includes('message_agent'),
    },
    productCertified: false,
  };
});
await mkdir('docs/compatibility', { recursive: true });
await writeFile(
  'docs/compatibility/source-evidence.json',
  `${JSON.stringify({ revisions: evidence }, null, 2)}\n`,
);
process.stdout.write('Source inventory recorded. This is not runtime or browser certification.\n');
for (const result of evidence) {
  process.stdout.write(
    `${result.revision.slice(0, 7)}: ${Object.values(result.checks).filter(Boolean).length}/6 source checks present; product remains unverified.\n`,
  );
}
