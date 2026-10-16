import type { Shape } from './avatar-lab/engine';
export type Appearance = {
  kind: 'shape' | 'photo';
  shape: Shape;
  color: string;
};
export type Role = {
  title: string;
  description: string;
  responsibilities: string;
  boundaries: string;
  expectedOutputs: string;
};
export type WorkspaceBot = {
  id: string;
  profile: string;
  handle: string;
  name: string;
  description: string;
  managed: boolean;
  enrolled: boolean;
  canonical: boolean;
  available?: boolean;
  hidden?: boolean;
  pinned?: boolean;
  pin_configured?: boolean;
  preview?: string;
  cursor?: number;
  cursor_type?: 'row' | 'count';
  read_key?: string;
  unread?: boolean;
  manager: string | null;
  team: string | null;
  appearance: Appearance;
  role: Role;
};
export type WorkspaceState = {
  id: string;
  revision: number;
  initialized: boolean;
  orchestrator: string | null;
  bots: WorkspaceBot[];
  teams: { id: string; name: string }[];
  welcome?: string;
  model_grant?: {
    source: string;
    provider: string;
    model: string;
    supported: boolean;
    auth_kind: string;
    fingerprint: string;
  };
};
export function workspaceState(value: unknown): WorkspaceState {
  if (!value || typeof value !== 'object') throw new Error('Invalid workspace');
  const v = value as WorkspaceState;
  if (
    !Number.isSafeInteger(v.revision) ||
    typeof v.initialized !== 'boolean' ||
    !Array.isArray(v.bots) ||
    v.bots.length > 10000 ||
    !Array.isArray(v.teams)
  )
    throw new Error('Invalid workspace');
  for (const b of v.bots)
    if (typeof b.profile !== 'string' || typeof b.handle !== 'string' || !b.appearance || !b.role)
      throw new Error('Invalid bot');
  return v;
}
