export type RailItem = { kind: 'pebble' | 'crew'; id: string };
export type Placement = { kind: 'section' | 'crew'; id: string };
export type Section = { id: string; name: string; collapsed: boolean; items: RailItem[] };
export type Crew = {
  id: string;
  name: string;
  purpose: string;
  collapsed: boolean;
  members: string[];
};
export type Organization = { sections: Section[]; crews: Crew[] };
export type OrganizationEditor =
  | { kind: 'new-section' }
  | { kind: 'edit-section'; id: string }
  | { kind: 'new-crew' }
  | { kind: 'edit-crew'; id: string };

export const initialOrganization: Organization = {
  sections: [
    {
      id: 'personal',
      name: 'Personal',
      collapsed: false,
      items: ['sample-0', 'sample-1', 'sample-2', 'sample-3'].map((id) => ({ kind: 'pebble', id })),
    },
    { id: 'crews', name: 'Crews', collapsed: false, items: [{ kind: 'crew', id: 'studio' }] },
  ],
  crews: [
    {
      id: 'studio',
      name: 'Studio',
      purpose: 'Design and writing',
      collapsed: false,
      members: ['sample-4', 'sample-5'],
    },
  ],
};

function insertBefore<T>(items: T[], item: T, before: (value: T) => boolean) {
  const index = items.findIndex(before);
  const next = [...items];
  next.splice(index < 0 ? items.length : index, 0, item);
  return next;
}

export function placePebble(
  org: Organization,
  id: string,
  target: Placement,
  beforeId?: string,
): Organization {
  const exists =
    target.kind === 'section'
      ? org.sections.some((s) => s.id === target.id)
      : org.crews.some((c) => c.id === target.id);
  if (!exists || beforeId === id) return org;
  return {
    sections: org.sections.map((s) => {
      const items = s.items.filter((item) => item.kind !== 'pebble' || item.id !== id);
      return {
        ...s,
        items:
          target.kind === 'section' && s.id === target.id
            ? insertBefore(items, { kind: 'pebble', id }, (item) => item.id === beforeId)
            : items,
      };
    }),
    crews: org.crews.map((c) => {
      const members = c.members.filter((member) => member !== id);
      return {
        ...c,
        members:
          target.kind === 'crew' && c.id === target.id
            ? insertBefore(members, id, (member) => member === beforeId)
            : members,
      };
    }),
  };
}

export function placeCrew(
  org: Organization,
  id: string,
  section: string,
  beforeId?: string,
): Organization {
  if (!org.sections.some((s) => s.id === section) || beforeId === id) return org;
  return {
    ...org,
    sections: org.sections.map((s) => {
      const items = s.items.filter((item) => item.kind !== 'crew' || item.id !== id);
      return {
        ...s,
        items:
          s.id === section
            ? insertBefore(items, { kind: 'crew', id }, (item) => item.id === beforeId)
            : items,
      };
    }),
  };
}

export function placementOf(org: Organization, id: string): Placement | undefined {
  const section = org.sections.find((s) =>
    s.items.some((item) => item.kind === 'pebble' && item.id === id),
  );
  if (section) return { kind: 'section', id: section.id };
  const crew = org.crews.find((c) => c.members.includes(id));
  return crew ? { kind: 'crew', id: crew.id } : undefined;
}

export function reorderSection(org: Organization, id: string, beforeId: string): Organization {
  const section = org.sections.find((s) => s.id === id);
  if (!section || id === beforeId || !org.sections.some((s) => s.id === beforeId)) return org;
  return {
    ...org,
    sections: insertBefore(
      org.sections.filter((s) => s.id !== id),
      section,
      (s) => s.id === beforeId,
    ),
  };
}

export function nudgeSection(org: Organization, id: string, direction: -1 | 1): Organization {
  const index = org.sections.findIndex((s) => s.id === id),
    next = index + direction;
  if (index < 0 || next < 0 || next >= org.sections.length) return org;
  const sections = [...org.sections];
  [sections[index], sections[next]] = [sections[next]!, sections[index]!];
  return { ...org, sections };
}

function neighbor(
  org: Organization,
  item: RailItem,
  direction: -1 | 1,
  pinnedIds: readonly string[],
) {
  const crew =
    item.kind === 'pebble' ? org.crews.find((c) => c.members.includes(item.id)) : undefined;
  const items: RailItem[] = crew
    ? crew.members.map((id) => ({ kind: 'pebble', id }))
    : (org.sections.find((s) => s.items.some((i) => i.kind === item.kind && i.id === item.id))
        ?.items ?? []);
  const visible = items.filter((i) => i.kind !== 'pebble' || !pinnedIds.includes(i.id));
  const index = visible.findIndex((i) => i.kind === item.kind && i.id === item.id);
  return index >= 0 ? visible[index + direction] : undefined;
}
export function nudgeItem(
  org: Organization,
  item: RailItem,
  direction: -1 | 1,
  pinnedIds: readonly string[] = [],
): Organization {
  const next = neighbor(org, item, direction, pinnedIds);
  if (!next) return org;
  const crew =
    item.kind === 'pebble' ? org.crews.find((c) => c.members.includes(item.id)) : undefined;
  if (crew) {
    const members = [...crew.members],
      a = members.indexOf(item.id),
      b = members.indexOf(next.id);
    [members[a], members[b]] = [members[b]!, members[a]!];
    return { ...org, crews: org.crews.map((c) => (c.id === crew.id ? { ...c, members } : c)) };
  }
  return {
    ...org,
    sections: org.sections.map((s) => {
      const a = s.items.findIndex((i) => i.kind === item.kind && i.id === item.id);
      if (a < 0) return s;
      const b = s.items.findIndex((i) => i.kind === next.kind && i.id === next.id),
        items = [...s.items];
      [items[a], items[b]] = [items[b]!, items[a]!];
      return { ...s, items };
    }),
  };
}
export function canNudgeItem(
  org: Organization,
  item: RailItem,
  direction: -1 | 1,
  pinnedIds: readonly string[] = [],
) {
  return neighbor(org, item, direction, pinnedIds) !== undefined;
}

export type RailDrag = RailItem | { kind: 'section'; id: string };
export function readRailDrag(
  value: string,
  org: Organization,
  pebbleIds: string[],
): RailDrag | undefined {
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (
    !data ||
    typeof data !== 'object' ||
    !('id' in data) ||
    !('kind' in data) ||
    typeof data.id !== 'string'
  )
    return undefined;
  const { id, kind } = data;
  if (kind === 'pebble' && pebbleIds.includes(id)) return { kind, id };
  if (kind === 'crew' && org.crews.some((c) => c.id === id)) return { kind, id };
  if (kind === 'section' && org.sections.some((s) => s.id === id)) return { kind, id };
  return undefined;
}
