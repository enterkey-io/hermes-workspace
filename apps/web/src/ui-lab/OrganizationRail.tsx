import { useEffect, useState } from 'react';
import type { Dispatch, DragEvent, ReactNode, SetStateAction } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Pin,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  nudgeItem,
  canNudgeItem,
  nudgeSection,
  placeCrew,
  placePebble,
  placementOf,
  readRailDrag,
  reorderSection,
} from './organization';
import type { Organization, OrganizationEditor, Placement, RailDrag } from './organization';

type RailPebble = { id: string; name: string; title: string; preview: string; pinned: boolean };
type ChangeOrganization = Dispatch<SetStateAction<Organization>>;
const dragFormat = 'application/x-pebble-crew-rail';
function drag(event: DragEvent, item: RailDrag) {
  event.stopPropagation();
  event.dataTransfer.setData(dragFormat, JSON.stringify(item));
  event.dataTransfer.effectAllowed = 'move';
}
function allow(event: DragEvent) {
  if (event.dataTransfer.types.includes(dragFormat)) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  }
}

function PlacementMenu({
  org,
  value,
  onMove,
}: {
  org: Organization;
  value: Placement | undefined;
  onMove: (target: Placement) => void;
}) {
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Move to section</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={value?.kind === 'section' ? value.id : ''}>
            {org.sections.map((section) => (
              <DropdownMenuRadioItem
                key={section.id}
                value={section.id}
                onSelect={() => onMove({ kind: 'section', id: section.id })}
              >
                {section.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Move to crew</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={value?.kind === 'crew' ? value.id : ''}>
            {org.crews.map((crew) => (
              <DropdownMenuRadioItem
                key={crew.id}
                value={crew.id}
                onSelect={() => onMove({ kind: 'crew', id: crew.id })}
              >
                {crew.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

export function PebbleActions({
  pebble,
  onPin,
  onEdit,
  org,
  onChange,
  pinnedIds = [],
}: {
  pebble: RailPebble;
  pinnedIds?: readonly string[];
  onPin: () => void;
  onEdit: () => void;
  org: Organization;
  onChange: ChangeOrganization;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="quiet"
          size="icon-sm"
          className="review-overflow"
          aria-label={`Actions for ${pebble.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem onSelect={onPin}>
          <Pin />
          {pebble.pinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>
          <SlidersHorizontal />
          Edit pebble
        </DropdownMenuItem>
        <PlacementMenu
          org={org}
          value={placementOf(org, pebble.id)}
          onMove={(target) => onChange((current) => placePebble(current, pebble.id, target))}
        />
        {!pebble.pinned && (
          <DropdownMenuItem
            disabled={!canNudgeItem(org, { kind: 'pebble', id: pebble.id }, -1, pinnedIds)}
            onSelect={() =>
              onChange((current) =>
                nudgeItem(current, { kind: 'pebble', id: pebble.id }, -1, pinnedIds),
              )
            }
          >
            <ArrowUp />
            Move up
          </DropdownMenuItem>
        )}
        {!pebble.pinned && (
          <DropdownMenuItem
            disabled={!canNudgeItem(org, { kind: 'pebble', id: pebble.id }, 1, pinnedIds)}
            onSelect={() =>
              onChange((current) =>
                nudgeItem(current, { kind: 'pebble', id: pebble.id }, 1, pinnedIds),
              )
            }
          >
            <ArrowDown />
            Move down
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrganizationRail({
  org,
  onChange,
  pebbles,
  activeId,
  face,
  onOpenPebble,
  onOpenCrew,
  onEditPebble,
  onEditOrganization,
  onPin,
}: {
  org: Organization;
  onChange: ChangeOrganization;
  pebbles: RailPebble[];
  activeId: string;
  face: (id: string) => ReactNode;
  onOpenPebble: (id: string) => void;
  onOpenCrew: (id: string) => void;
  onEditPebble: (id: string) => void;
  onEditOrganization: (editor: OrganizationEditor) => void;
  onPin: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const pinnedIds = pebbles.filter((p) => p.pinned).map((p) => p.id);
  const [over, setOver] = useState('');
  const move = { duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] as const };
  function dropped(event: DragEvent, target: Placement, beforeId?: string) {
    event.preventDefault();
    event.stopPropagation();
    setOver('');
    const item = readRailDrag(
      event.dataTransfer.getData(dragFormat),
      org,
      pebbles.map((p) => p.id),
    );
    if (!item) return;
    onChange((current) =>
      item.kind === 'section'
        ? target.kind === 'section'
          ? reorderSection(current, item.id, target.id)
          : current
        : item.kind === 'pebble'
          ? placePebble(current, item.id, target, beforeId)
          : target.kind === 'section'
            ? placeCrew(current, item.id, target.id, beforeId)
            : current,
    );
  }
  function targetEvents(target: Placement, beforeId?: string) {
    const key = `${target.kind}:${target.id}:${beforeId ?? ''}`;
    return {
      onDragOver: (event: DragEvent) => {
        allow(event);
        if (event.defaultPrevented) setOver(key);
      },
      onDragLeave: () => setOver(''),
      onDrop: (event: DragEvent) => dropped(event, target, beforeId),
      'data-drop-target': over === key || undefined,
    };
  }
  function row(id: string, target: Placement) {
    const pebble = pebbles.find((p) => p.id === id);
    if (!pebble || pebble.pinned) return null;
    return (
      <motion.div
        layout
        transition={move}
        key={id}
        className={`review-row pebble-row ${activeId === id ? 'is-selected' : ''}`}
        draggable
        onDragStartCapture={(event) => drag(event, { kind: 'pebble', id })}
        onDragEnd={() => setOver('')}
        {...targetEvents(target, id)}
      >
        <button
          className="review-row-open"
          onClick={() => onOpenPebble(id)}
          aria-label={`Open ${pebble.name}`}
        >
          {face(id)}
          <span className="review-row-copy">
            <span>
              <strong>{pebble.name}</strong>
              <Badge variant="secondary">{pebble.title}</Badge>
            </span>
            <small>{pebble.preview}</small>
          </span>
        </button>
        <PebbleActions
          pebble={pebble}
          pinnedIds={pinnedIds}
          onPin={() => onPin(id)}
          onEdit={() => onEditPebble(id)}
          org={org}
          onChange={onChange}
        />
      </motion.div>
    );
  }
  function crewRow(id: string, sectionId: string) {
    const crew = org.crews.find((c) => c.id === id);
    if (!crew) return null;
    return (
      <motion.div layout transition={move} key={id} className="review-crew-group">
        <div
          className={`review-row review-crew-row ${activeId === id ? 'is-selected' : ''}`}
          draggable
          onDragStart={(event) => drag(event, { kind: 'crew', id })}
          {...targetEvents({ kind: 'crew', id })}
        >
          <button
            className="review-crew"
            aria-label={`Open ${crew.name} chat`}
            onClick={() => onOpenCrew(id)}
          >
            <span className="review-crew-faces">
              {crew.members.length ? (
                crew.members.slice(0, 2).map((member) => <span key={member}>{face(member)}</span>)
              ) : (
                <Users />
              )}
            </span>
            <span>
              <strong>{crew.name}</strong>
              <small>{crew.members.length} pebbles</small>
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="quiet"
                size="icon-sm"
                className="review-overflow"
                aria-label={`Actions for ${crew.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEditOrganization({ kind: 'edit-crew', id })}>
                <SlidersHorizontal />
                Crew settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  onChange((current) => ({
                    ...current,
                    crews: current.crews.map((c) =>
                      c.id === id ? { ...c, collapsed: !c.collapsed } : c,
                    ),
                  }))
                }
              >
                {crew.collapsed ? 'Show pebbles' : 'Collapse pebbles'}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to section</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={sectionId}>
                    {org.sections.map((section) => (
                      <DropdownMenuRadioItem
                        key={section.id}
                        value={section.id}
                        onSelect={() => onChange((current) => placeCrew(current, id, section.id))}
                      >
                        {section.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                disabled={!canNudgeItem(org, { kind: 'crew', id }, -1, pinnedIds)}
                onSelect={() =>
                  onChange((current) => nudgeItem(current, { kind: 'crew', id }, -1, pinnedIds))
                }
              >
                <ArrowUp />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canNudgeItem(org, { kind: 'crew', id }, 1, pinnedIds)}
                onSelect={() =>
                  onChange((current) => nudgeItem(current, { kind: 'crew', id }, 1, pinnedIds))
                }
              >
                <ArrowDown />
                Move down
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <AnimatePresence initial={false}>
          {!crew.collapsed && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={move}
              style={{ overflow: 'hidden' }}
              className="review-crew-members"
              aria-label={`${crew.name} pebbles`}
              {...targetEvents({ kind: 'crew', id })}
            >
              {crew.members.map((member) => row(member, { kind: 'crew', id }))}
              {!crew.members.length && (
                <p className="review-section-empty">Move a pebble here from its menu.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }
  return (
    <>
      {org.sections.map((section, index) => (
        <motion.section
          layout
          transition={move}
          key={section.id}
          className="review-list"
          aria-label={section.name}
          {...targetEvents({ kind: 'section', id: section.id })}
        >
          <div className="review-section-header">
            <button
              className="review-section-toggle"
              aria-expanded={!section.collapsed}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  sections: current.sections.map((s) =>
                    s.id === section.id ? { ...s, collapsed: !s.collapsed } : s,
                  ),
                }))
              }
            >
              <ChevronDown data-collapsed={section.collapsed} />
              <span>{section.name}</span>
            </button>
            <span
              className="review-section-grip"
              aria-hidden="true"
              title="Drag section"
              draggable
              onDragStart={(event) => drag(event, { kind: 'section', id: section.id })}
            >
              <GripVertical />
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="quiet"
                  size="icon-sm"
                  className="review-overflow"
                  aria-label={`Actions for ${section.name} section`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => onEditOrganization({ kind: 'edit-section', id: section.id })}
                >
                  Rename section
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === 0}
                  onSelect={() => onChange((current) => nudgeSection(current, section.id, -1))}
                >
                  <ArrowUp />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={index === org.sections.length - 1}
                  onSelect={() => onChange((current) => nudgeSection(current, section.id, 1))}
                >
                  <ArrowDown />
                  Move down
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <AnimatePresence initial={false}>
            {!section.collapsed && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={move}
                style={{ overflow: 'hidden' }}
                className="review-section-items"
              >
                {section.items.map((item) =>
                  item.kind === 'pebble'
                    ? row(item.id, { kind: 'section', id: section.id })
                    : crewRow(item.id, section.id),
                )}
                {!section.items.length && (
                  <p className="review-section-empty">Move pebbles or crews here.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      ))}
    </>
  );
}

export function OrganizationDialog({
  editor,
  org,
  onChange,
  onClose,
}: {
  editor: OrganizationEditor | null;
  org: Organization;
  onChange: ChangeOrganization;
  onClose: () => void;
}) {
  const [name, setName] = useState(''),
    [purpose, setPurpose] = useState('');
  const isCrew = editor?.kind === 'new-crew' || editor?.kind === 'edit-crew';
  useEffect(() => {
    if (!editor) return;
    const entity =
      editor.kind === 'edit-crew'
        ? org.crews.find((c) => c.id === editor.id)
        : editor.kind === 'edit-section'
          ? org.sections.find((s) => s.id === editor.id)
          : undefined;
    setName(entity?.name ?? '');
    setPurpose(entity && 'purpose' in entity ? entity.purpose : '');
  }, [editor]);
  function save() {
    if (!editor || !name.trim()) return;
    const id = crypto.randomUUID();
    onChange((current) => {
      switch (editor.kind) {
        case 'new-section':
          return {
            ...current,
            sections: [...current.sections, { id, name: name.trim(), collapsed: false, items: [] }],
          };
        case 'edit-section':
          return {
            ...current,
            sections: current.sections.map((s) =>
              s.id === editor.id ? { ...s, name: name.trim() } : s,
            ),
          };
        case 'new-crew':
          return {
            ...current,
            crews: [
              ...current.crews,
              { id, name: name.trim(), purpose, collapsed: false, members: [] },
            ],
            sections: current.sections.map((s, i) =>
              i === current.sections.length - 1
                ? { ...s, items: [...s.items, { kind: 'crew', id }] }
                : s,
            ),
          };
        case 'edit-crew':
          return {
            ...current,
            crews: current.crews.map((c) =>
              c.id === editor.id ? { ...c, name: name.trim(), purpose } : c,
            ),
          };
      }
    });
    onClose();
  }
  const title =
    editor?.kind === 'edit-crew'
      ? 'Crew settings'
      : editor?.kind === 'edit-section'
        ? 'Rename section'
        : isCrew
          ? 'New crew'
          : 'New section';
  return (
    <Dialog
      open={!!editor}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>('[aria-label="New"]')?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Organize this local design preview.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="review-organization-form"
        >
          <div>
            <Label htmlFor="organization-name">Name</Label>
            <Input
              id="organization-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
            />
          </div>
          {isCrew && (
            <div>
              <Label htmlFor="organization-purpose">Purpose</Label>
              <Textarea
                id="organization-purpose"
                rows={3}
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              />
            </div>
          )}
          <div className="review-form-footer">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!name.trim()} type="submit">
              {editor?.kind.startsWith('new') ? 'Create' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
