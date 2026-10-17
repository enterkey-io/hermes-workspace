export type Remote<T> = { kind: 'loading' } | { kind: 'ready'; value: T } | { kind: 'error' };
export type Connection = {
  name: string;
  description: string;
  enabled: boolean;
  auth: string | null;
  needsSignIn: boolean;
};
export type Service = { name: string; description: string; available: boolean };
export type Tool = { name: string; description: string };
export type ToolPolicy = { kind: 'native' } | { kind: 'custom'; names: string[] };
export type Permission = {
  fingerprint: string;
  policy: ToolPolicy;
  bearer: boolean;
  oauth: boolean;
};
export type AuthFlow = {
  id: string;
  state: 'waiting' | 'authorize' | 'approved' | 'error';
  url: string | null;
};
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function rows(value: unknown) {
  if (!object(value) || !Array.isArray(value.servers)) throw new Error('Invalid services');
  return value.servers;
}
function name(value: unknown): string {
  if (!object(value) || typeof value.name !== 'string' || !value.name)
    throw new Error('Invalid name');
  return value.name;
}
export function connections(value: unknown): Connection[] {
  return rows(value).map((row: unknown) => {
    const title = name(row);
    if (!object(row)) throw new Error('Invalid connection');
    return {
      name: title,
      description: typeof row.description === 'string' ? row.description : '',
      enabled: row.enabled !== false,
      auth: typeof row.auth === 'string' ? row.auth : null,
      needsSignIn: row.auth === 'oauth' && row.oauth_tokens_present === false,
    };
  });
}
export function services(value: unknown): Service[] {
  return rows(value).map((row: unknown) => {
    const title = name(row);
    if (!object(row)) throw new Error('Invalid service');
    return {
      name: title,
      description: typeof row.description === 'string' ? row.description : '',
      available:
        row.installed === true ||
        ['http', 'sse', 'streamable-http'].includes(String(row.transport)),
    };
  });
}
export function permissions(value: unknown): Permission {
  if (!object(value) || typeof value.fingerprint !== 'string' || !value.fingerprint)
    throw new Error('Invalid permissions');
  const allowed = value.allowed_tools;
  if (
    allowed !== null &&
    (!Array.isArray(allowed) || !allowed.every((v: unknown) => typeof v === 'string'))
  )
    throw new Error('Invalid policy');
  return {
    fingerprint: value.fingerprint,
    policy: allowed === null ? { kind: 'native' } : { kind: 'custom', names: allowed },
    oauth: value.auth === 'oauth',
    bearer: value.auth !== 'oauth' && value.bearer_supported === true,
  };
}
export function probe(
  value: unknown,
): { kind: 'connected'; tools: Tool[] } | { kind: 'failed'; signIn: boolean } {
  if (!object(value)) throw new Error('Invalid probe');
  if (value.ok !== true) return { kind: 'failed', signIn: value.oauth_needed === true };
  if (!Array.isArray(value.tools)) throw new Error('Invalid tools');
  return {
    kind: 'connected',
    tools: value.tools.map((row: unknown) => {
      const title = name(row);
      return {
        name: title,
        description: object(row) && typeof row.description === 'string' ? row.description : '',
      };
    }),
  };
}
export function keySaved(value: unknown) {
  if (!object(value) || value.saved !== true) throw new Error('Key save not confirmed');
}
export function authFlow(value: unknown): AuthFlow {
  if (!object(value) || typeof value.id !== 'string' || !value.id)
    throw new Error('Invalid sign-in');
  let url = null;
  if (typeof value.authorization_url === 'string') {
    const parsed = new URL(value.authorization_url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      throw new Error('Invalid sign-in URL');
    url = parsed.href;
  }
  return {
    id: value.id,
    url,
    state:
      value.status === 'approved'
        ? 'approved'
        : value.status === 'error'
          ? 'error'
          : value.status === 'authorization_required' && url
            ? 'authorize'
            : 'waiting',
  };
}
export function policyLabel(policy: ToolPolicy): string {
  return policy.kind === 'native'
    ? 'Uses Hermes tool settings'
    : policy.names.length
      ? `${policy.names.length} ${policy.names.length === 1 ? 'tool' : 'tools'} allowed`
      : 'No tools allowed';
}
export function policyKey(policy: ToolPolicy) {
  return policy.kind === 'native' ? 'native' : JSON.stringify([...policy.names].sort());
}
export function toolTitle(name: string) {
  const words = name.replace(/[_-]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
