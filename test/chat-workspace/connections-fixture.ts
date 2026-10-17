import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
export async function connectionFixture(page: Page) {
  const servers = [
    { name: 'Papertrail', auth: 'oauth', enabled: true, oauth_tokens_present: false },
    { name: 'Archive', enabled: true },
    { name: 'Weather', enabled: true },
    { name: 'Notes', enabled: true },
    { name: 'Research', enabled: false },
    { name: 'Long_service_name_for_a_shared_document_library', enabled: true },
  ];
  const catalog = [
    { name: 'Calendar', description: 'Events and availability.', transport: 'http' },
    { name: 'Files', description: 'Find and organize documents.', transport: 'http' },
    {
      name: 'Desktop',
      description: 'Apps on your computer.',
      transport: 'stdio',
      installed: false,
    },
    { name: 'Papertrail', description: 'Search your documents.', transport: 'http' },
  ];
  const calls: { operation: string; params: Record<string, unknown> }[] = [];
  const pendingAdd: { wait?: Promise<void> } = {};
  const policies = new Map<string, string[] | null>([
    ['Papertrail', null],
    ['Archive', ['search_documents']],
  ]);
  const control = {
    approve: false,
    keySaved: true,
    catalogError: false,
    listError: false,
    permissionsError: false,
  };
  await page.route('**/v1/rpc', async (route) => {
    const call = route.request().postDataJSON();
    if (!call.operation.startsWith('connections.') && call.operation !== 'services.catalog')
      return route.fallback();
    calls.push(call);
    if (
      (call.operation === 'services.catalog' && control.catalogError) ||
      (call.operation === 'connections.list' && control.listError) ||
      (call.operation === 'connections.permissions' && control.permissionsError)
    )
      return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } });
    let result: unknown;
    if (call.operation === 'connections.list')
      result = { servers: call.params.profile === 'mica' ? [] : servers };
    else if (call.operation === 'services.catalog') result = { servers: catalog };
    else if (call.operation === 'connections.permissions') {
      if (call.params.tools) policies.set(call.params.name, call.params.tools);
      const oauth = ['Papertrail', 'Calendar'].includes(call.params.name);
      result = {
        fingerprint: 'synthetic',
        allowed_tools: policies.has(call.params.name) ? policies.get(call.params.name) : [],
        bearer_supported: !oauth,
        auth: oauth ? 'oauth' : null,
      };
    } else if (call.operation === 'connections.test')
      result = {
        ok: true,
        tools: Array.from({ length: 16 }, (_, i) => ({
          name: i ? `document_action_${i}` : 'search_documents',
          description: i
            ? `Work with library documents, action ${i}.`
            : 'Find documents by title or content.',
        })),
      };
    else if (call.operation === 'connections.set_key') result = { saved: control.keySaved };
    else if (
      call.operation === 'connections.auth_start' ||
      call.operation === 'connections.auth_status'
    ) {
      if (control.approve) {
        policies.set(call.params.name ?? 'Papertrail', []);
        for (const server of servers)
          if (server.name === 'Papertrail') server.oauth_tokens_present = true;
      }
      result = {
        id: 'synthetic-flow',
        status: control.approve ? 'approved' : 'authorization_required',
        authorization_url: 'https://auth.example.test/authorize',
      };
    } else if (call.operation === 'connections.auth_cancel')
      result = { id: 'synthetic-flow', status: 'error', authorization_url: null };
    else if (call.operation === 'connections.add') {
      await pendingAdd.wait;
      servers.push({
        name: call.params.name,
        enabled: true,
        auth: 'oauth',
        oauth_tokens_present: false,
      });
      result = { saved: true };
    } else return route.fallback();
    await route.fulfill({ json: { result } });
  });
  return { calls, policies, control, pendingAdd };
}
export async function openConnections(page: Page) {
  await page.goto('/');
  await expect(page.getByLabel('Message', { exact: true })).toBeEnabled();
  if (!(await page.getByRole('button', { name: 'Your account', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Your account', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Connections', exact: true }).click();
}
