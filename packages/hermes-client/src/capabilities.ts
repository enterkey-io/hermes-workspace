import { ClientError } from '@hermes-client/core';
import { record } from './json';
import type { AgentHttpClient } from './http';

export interface AgentCapabilities {
  readonly features: Readonly<Record<string, boolean>>;
  /** Agent API discovery does not establish access to native Bot Mode RPC. */
  readonly botModeCertified: false;
}

export async function getAgentCapabilities(client: AgentHttpClient): Promise<AgentCapabilities> {
  const result = record(await client.request('v1/capabilities'));
  if (result.object !== 'hermes.api_server.capabilities' || result.platform !== 'hermes-agent') {
    throw new ClientError('INVALID_RESPONSE');
  }
  const rawFeatures = record(result.features);
  const features: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
  for (const [key, value] of Object.entries(rawFeatures)) {
    if (!/^[a-z0-9_]{1,80}$/u.test(key) || typeof value !== 'boolean') {
      throw new ClientError('INVALID_RESPONSE');
    }
    features[key] = value;
  }
  // Ignore server-supplied URLs. Only verified, application-owned routes are used.
  return { features: Object.freeze(features), botModeCertified: false };
}
