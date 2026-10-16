import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { MotionConfig, motion, useReducedMotion, useMotionValue, animate } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  Copy,
  ChevronRight,
  File,
  FileText,
  Folder,
  Image,
  LogOut,
  Menu,
  Plus,
  Search,
  SlidersHorizontal,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { IconButton as IconAction } from '@/components/ui/icon-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AgentAvatar } from '../AgentAvatar';
import { COLORS, SHAPES } from '../avatar-lab/engine';
import { previewPhoto } from '../avatar-lab/photo';
import type { Appearance } from '../workspace';
import { OrganizationRail, PebbleActions, OrganizationDialog } from './OrganizationRail';
import { initialOrganization, placePebble } from './organization';
import type { Crew, OrganizationEditor } from './organization';

type Pebble = {
  id: string;
  name: string;
  title: string;
  preview: string;
  look: Appearance;
  pinned: boolean;
  photo?: string;
};
type ReviewMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  fresh?: boolean;
};
type Overlay =
  | { kind: 'none' }
  | { kind: 'search' }
  | { kind: 'existing' }
  | { kind: 'edit'; pebble: Pebble }
  | { kind: 'create' }
  | { kind: 'organize'; editor: OrganizationEditor };
const seedPebbles: Pebble[] = [
  ['Arlo', 'Chief of staff', 'The brief is ready for your review.', 'pebble', 'iris'],
  ['Mica', 'Executive assistant', 'Your afternoon is clear.', 'beacon', 'sky'],
  ['Rowan', 'Operations', 'Everything is ready for Monday.', 'petal', 'clay'],
  ['Sage', 'Researcher', 'I found three useful sources.', 'kite', 'lagoon'],
  ['Ember', 'Writer', 'Here is the updated draft.', 'arch', 'rose'],
  ['Cleo', 'Product designer', 'Two directions to compare.', 'pebble', 'white'],
].map(([name, title, preview, shape, color], i) => ({
  id: `sample-${i}`,
  name: name!,
  title: title!,
  preview: preview!,
  look: { kind: 'shape', shape: SHAPES.find((s) => s === shape) ?? 'pebble', color: color! },
  pinned: i < 2,
}));
const sampleMessages: ReviewMessage[] = [
  {
    id: 'sample-message-1',
    role: 'assistant',
    text: 'The launch brief is ready. I kept the scope focused on the first useful version, and grouped the open questions so we can work through them together.',
    at: Date.now() - 54 * 60000,
  },
  {
    id: 'sample-message-2',
    role: 'user',
    text: 'What should we focus on first?',
    at: Date.now() - 50 * 60000,
  },
  {
    id: 'sample-message-3',
    role: 'assistant',
    text: 'Start with the everyday conversation. It should feel effortless to open a pebble, send a message, and keep reading while they work.\n\nMica is checking the schedule. Sage will bring back the research. I’ll pull their findings into a short recommendation.',
    at: Date.now() - 48 * 60000,
  },
  {
    id: 'sample-message-4',
    role: 'user',
    text: 'Keep it simple. I want to see what changed and what needs my attention.',
    at: Date.now() - 42 * 60000,
  },
  {
    id: 'sample-message-5',
    role: 'assistant',
    text: 'Will do. I’ll bring you the decisions, with enough context to make the call. The supporting work will stay available when you want to look closer.',
    at: Date.now() - 40 * 60000,
  },
];
const easing = [0.22, 1, 0.36, 1] as const;
function focusLive(selector: string, preferred?: HTMLElement | null) {
  const target = [preferred, ...document.querySelectorAll<HTMLElement>(selector)].find(
    (node) => node?.isConnected && node.getClientRects().length && !node.closest('[inert]'),
  );
  target?.focus({ preventScroll: true });
}

function Face({ pebble, large = false }: { pebble: Pebble; large?: boolean }) {
  return (
    <AgentAvatar
      id={pebble.id}
      look={pebble.look}
      photo={pebble.photo ?? ''}
      large={large}
      orchestrator={pebble.id === 'sample-0'}
    />
  );
}
function useWideScreen(query: string) {
  const [wide, setWide] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const change = () => setWide(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return wide;
}

export function UiReview() {
  const [pebbles, setPebbles] = useState(seedPebbles);
  const [selected, setSelected] = useState(seedPebbles[0]!);
  const [organization, setOrganization] = useState(initialOrganization);
  const [crewId, setCrewId] = useState<string | null>(null);
  const selectedCrew = organization.crews.find((crew) => crew.id === crewId);
  const conversationKey = selectedCrew ? `crew:${selectedCrew.id}` : `pebble:${selected.id}`;
  const [histories, setHistories] = useState<Record<string, ReviewMessage[]>>({
    'pebble:sample-0': sampleMessages,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [page, setPage] = useState<'chat' | 'settings'>('chat');
  const searchReturn = useRef<HTMLElement | null>(null);
  const [details, setDetails] = useState(() => matchMedia('(min-width: 768px)').matches);
  const [navigation, setNavigation] = useState(false);
  const messages = histories[conversationKey] ?? [];
  const draft = drafts[conversationKey] ?? '';
  const setDraft = (value: string) =>
    setDrafts((items) => ({ ...items, [conversationKey]: value }));
  const [activity, setActivity] = useState<Record<string, 'thinking' | 'working'>>({});
  const working = activity[conversationKey];
  const [latest, setLatest] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<Record<string, string[]>>({});
  const attachments = chatAttachments[conversationKey] ?? [];
  function setAttachments(value: SetStateAction<string[]>) {
    setChatAttachments((items) => ({
      ...items,
      [conversationKey]: typeof value === 'function' ? value(items[conversationKey] ?? []) : value,
    }));
  }
  const mobile = !useWideScreen('(min-width: 768px)');
  const compactNavigation = !useWideScreen('(min-width: 1024px)');
  const roomy = useWideScreen('(min-width: 1400px)');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const resize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const panelWidth = mobile ? windowWidth : roomy ? 320 : 288;
  const detailsWidth = useMotionValue(details ? panelWidth : 0);
  const reduced = useReducedMotion();
  const viewport = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const following = useRef(true);
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toggle = useRef<HTMLButtonElement>(null);
  function openSearch() {
    searchReturn.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOverlay({ kind: 'search' });
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (overlay.kind === 'none') openSearch();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [overlay.kind]);
  useLayoutEffect(() => {
    if (following.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [messages, working]);
  function capture() {
    const root = viewport.current;
    if (!root || following.current) {
      anchor.current = null;
      return;
    }
    const top = root.getBoundingClientRect().top;
    const first = [...root.querySelectorAll<HTMLElement>('[data-message-id]')].find(
      (node) => node.getBoundingClientRect().bottom > top + 12,
    );
    anchor.current = first
      ? { id: first.dataset.messageId!, top: first.getBoundingClientRect().top - top }
      : null;
  }
  function preserve() {
    const root = viewport.current;
    if (!root) return;
    if (following.current) root.scrollTop = root.scrollHeight;
    else if (anchor.current) {
      const node = root.querySelector<HTMLElement>(`[data-message-id="${anchor.current.id}"]`);
      if (node)
        root.scrollTop +=
          node.getBoundingClientRect().top - root.getBoundingClientRect().top - anchor.current.top;
    }
  }
  function showDetails(next: boolean) {
    capture();
    if (!next) requestAnimationFrame(() => toggle.current?.focus({ preventScroll: true }));
    setDetails(next);
    if (next && mobile)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('#conversation-details h2')
          ?.focus({ preventScroll: true }),
      );
  }
  function openPebble(pebble: Pebble) {
    setPage('chat');
    setSelected(pebble);
    setCrewId(null);
    setNavigation(false);
    following.current = true;
  }
  function pin(pebble: Pebble) {
    setPebbles((items) => items.map((p) => (p.id === pebble.id ? { ...p, pinned: !p.pinned } : p)));
  }
  function openCrew(id: string) {
    setPage('chat');
    setCrewId(id);
    setNavigation(false);
    following.current = true;
  }
  function send() {
    if ((!draft.trim() && !attachments.length) || working) return;
    const key = conversationKey;
    following.current = true;
    const message: ReviewMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: [draft.trim(), ...attachments.map((name) => `📎 ${name}`)].filter(Boolean).join('\n'),
      at: Date.now(),
      fresh: true,
    };
    setHistories((items) => ({ ...items, [key]: [...(items[key] ?? []), message] }));
    setDraft('');
    setAttachments([]);
    setActivity((items) => ({ ...items, [key]: 'thinking' }));
    timers.current.push(
      setTimeout(() => setActivity((items) => ({ ...items, [key]: 'working' })), 2600),
    );
    timers.current.push(
      setTimeout(() => {
        setActivity((items) => {
          const next = { ...items };
          delete next[key];
          return next;
        });
        setHistories((items) => ({
          ...items,
          [key]: [
            ...(items[key] ?? []),
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: 'This is the interaction preview. Your message stays local to this page; no Hermes request was sent.',
              at: Date.now(),
              fresh: true,
            },
          ],
        }));
      }, 6500),
    );
  }
  const rail = (
    <aside className="review-rail" aria-label="Pebbles and crews">
      <header className="review-rail-header">
        <span className="review-wordmark">Pebble Crew</span>
        <IconAction label="Search Pebble Crew" icon={Search} onClick={openSearch} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="New">
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setOverlay({ kind: 'existing' })}>
              <UserPlus />
              Add existing pebbles
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOverlay({ kind: 'create' })}>
              <Plus />
              Create pebble
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setOverlay({ kind: 'organize', editor: { kind: 'new-crew' } })}
            >
              <Users />
              New crew
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setOverlay({ kind: 'organize', editor: { kind: 'new-section' } })}
            >
              <Folder />
              New section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="review-rail-scroll">
        <motion.div
          className="review-pins"
          layout
          transition={{ duration: reduced ? 0 : 0.22, ease: easing }}
        >
          {pebbles
            .filter((p) => p.pinned)
            .map((pebble) => (
              <motion.div
                layout
                key={pebble.id}
                className={`review-pin pinned-tile ${!selectedCrew && selected.id === pebble.id ? 'is-selected' : ''}`}
                transition={{ duration: reduced ? 0 : 0.22, ease: easing }}
              >
                <div className="review-pin-actions">
                  <PebbleActions
                    pebble={pebble}
                    onPin={() => pin(pebble)}
                    onEdit={() => setOverlay({ kind: 'edit', pebble })}
                    org={organization}
                    onChange={setOrganization}
                  />
                </div>
                <button
                  className="review-pin-open"
                  onClick={() => openPebble(pebble)}
                  aria-label={`Open ${pebble.name}`}
                >
                  <Face pebble={pebble} large />
                  <strong>{pebble.name}</strong>
                  <Badge variant="secondary">{pebble.title}</Badge>
                </button>
              </motion.div>
            ))}
        </motion.div>
        <OrganizationRail
          org={organization}
          onChange={setOrganization}
          pebbles={pebbles}
          activeId={selectedCrew?.id ?? selected.id}
          face={(id) => {
            const p = pebbles.find((item) => item.id === id);
            return p ? <Face pebble={p} /> : null;
          }}
          onOpenPebble={(id) => {
            const p = pebbles.find((item) => item.id === id);
            if (p) openPebble(p);
          }}
          onOpenCrew={openCrew}
          onEditPebble={(id) => {
            const p = pebbles.find((item) => item.id === id);
            if (p) setOverlay({ kind: 'edit', pebble: p });
          }}
          onEditOrganization={(editor) => setOverlay({ kind: 'organize', editor })}
          onPin={(id) => {
            const p = pebbles.find((item) => item.id === id);
            if (p) pin(p);
          }}
        />
      </div>
      <footer className="review-rail-footer">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
              aria-label="Your account"
            >
              <User />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem
              onSelect={() => {
                setPage('settings');
                setNavigation(false);
              }}
            >
              <SlidersHorizontal />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOverlay({ kind: 'existing' })}>
              <Users />
              Manage pebbles
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span>Design review · sample data</span>
      </footer>
    </aside>
  );
  useEffect(() => {
    const controls = animate(detailsWidth, details && page === 'chat' ? panelWidth : 0, {
      duration: reduced ? 0 : 0.24,
      ease: easing,
      onUpdate: () => requestAnimationFrame(preserve),
      onComplete: () => {
        preserve();
        anchor.current = null;
      },
    });
    return () => controls.stop();
  }, [panelWidth, details, page, reduced, detailsWidth]);
  const inspector = selectedCrew ? (
    <CrewDetails
      crew={selectedCrew}
      members={pebbles.filter((p) => selectedCrew.members.includes(p.id))}
      onClose={() => showDetails(false)}
      onEdit={() =>
        setOverlay({ kind: 'organize', editor: { kind: 'edit-crew', id: selectedCrew.id } })
      }
      onOpen={openPebble}
    />
  ) : (
    <Details
      pebble={selected}
      onClose={() => showDetails(false)}
      onEdit={() => setOverlay({ kind: 'edit', pebble: selected })}
    />
  );
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={350}>
        <div className="review-shell">
          {!compactNavigation && rail}
          <main className="review-main" inert={mobile && details && page === 'chat'}>
            {page === 'settings' ? (
              <SettingsPanel
                onClose={() => {
                  setPage('chat');
                  requestAnimationFrame(() =>
                    focusLive('[aria-label="Your account"],[aria-label="Open navigation"]'),
                  );
                }}
              />
            ) : (
              <>
                <header className="review-chat-header">
                  {compactNavigation && (
                    <IconAction
                      label="Open navigation"
                      icon={Menu}
                      onClick={() => setNavigation(true)}
                    />
                  )}
                  <button
                    ref={toggle}
                    className="review-chat-identity"
                    aria-label={`${selectedCrew?.name ?? selected.name} details`}
                    aria-expanded={details}
                    aria-controls="conversation-details"
                    onClick={() => showDetails(!details)}
                  >
                    {selectedCrew ? (
                      <span className="review-header-crew">
                        <Users />
                      </span>
                    ) : (
                      <Face pebble={selected} />
                    )}
                    <span>
                      <strong>{selectedCrew?.name ?? selected.name}</strong>
                      <small>
                        {selectedCrew ? `${selectedCrew.members.length} pebbles` : selected.title}
                      </small>
                    </span>
                    <ChevronRight className="review-details-chevron" data-open={details} />
                  </button>
                </header>
                <div
                  className="review-transcript"
                  ref={viewport}
                  onScroll={() => {
                    const root = viewport.current;
                    if (root) {
                      following.current =
                        root.scrollHeight - root.scrollTop - root.clientHeight < 96;
                      setLatest(!following.current);
                    }
                  }}
                >
                  <div className="review-messages">
                    <p className="review-date">Today</p>
                    {messages.map((message) => (
                      <Message key={message.id} message={message} />
                    ))}
                    {!messages.length && !working && (
                      <div className="review-empty-chat">
                        <h1>{selectedCrew?.name ?? selected.name}</h1>
                        <p>
                          {selectedCrew
                            ? 'Start a conversation with this crew.'
                            : 'Start a conversation.'}
                        </p>
                      </div>
                    )}
                    <div className="review-activity-lane" role="status" aria-atomic="true">
                      {working && (
                        <span className="review-activity" data-activity={working}>
                          {working === 'thinking' ? 'Thinking' : 'Working'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {latest && (
                  <Button
                    className="review-latest rounded-full"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      following.current = true;
                      viewport.current?.scrollTo({
                        top: viewport.current.scrollHeight,
                        behavior: reduced ? 'instant' : 'smooth',
                      });
                    }}
                  >
                    <ArrowDown />
                    Latest messages
                  </Button>
                )}
                <div className="review-composer-wrap">
                  <form
                    className="review-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send();
                    }}
                  >
                    {!!attachments.length && (
                      <div className="review-attachment-list">
                        {attachments.map((name) => (
                          <span key={name}>
                            <FileText />
                            {name}
                            <IconAction
                              label={`Remove ${name}`}
                              icon={X}
                              onClick={() =>
                                setAttachments((items) => items.filter((n) => n !== name))
                              }
                            />
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="review-composer-row">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Add attachment"
                            className="rounded-full"
                          >
                            <Plus />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start">
                          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                            <File />
                            File
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => imageInput.current?.click()}>
                            <Image />
                            Photo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <input
                        ref={fileInput}
                        type="file"
                        hidden
                        multiple
                        aria-label="Choose files"
                        onChange={(e) =>
                          setAttachments(
                            [...(e.currentTarget.files ?? [])].slice(0, 5).map((f) => f.name),
                          )
                        }
                      />
                      <input
                        ref={imageInput}
                        type="file"
                        hidden
                        multiple
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Choose photos"
                        onChange={(e) =>
                          setAttachments(
                            [...(e.currentTarget.files ?? [])].slice(0, 5).map((f) => f.name),
                          )
                        }
                      />
                      <Textarea
                        aria-label="Message"
                        value={draft}
                        placeholder={`Message ${selectedCrew?.name ?? selected.name}`}
                        rows={1}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="rounded-full"
                        aria-label="Send message"
                        disabled={!!working || (!draft.trim() && !attachments.length)}
                      >
                        <ArrowUp />
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </main>
          <motion.div
            id="conversation-details"
            className="review-details-slot"
            initial={false}
            style={{ width: detailsWidth }}
            onUpdate={preserve}
          >
            <div
              className="review-details-fixed"
              style={{ width: panelWidth }}
              inert={!details || page === 'settings'}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !event.defaultPrevented && overlay.kind === 'none') {
                  event.preventDefault();
                  showDetails(false);
                }
              }}
            >
              {inspector}
            </div>
          </motion.div>
          {compactNavigation && (
            <Sheet open={navigation && overlay.kind === 'none'} onOpenChange={setNavigation}>
              <SheetContent
                side="left"
                className="review-nav-sheet"
                showCloseButton={false}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  if (overlay.kind === 'none') focusLive('[aria-label="Open navigation"]');
                }}
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">Pebbles and crews.</SheetDescription>
                {rail}
              </SheetContent>
            </Sheet>
          )}
          <SearchOverlay
            onRestoreFocus={() =>
              focusLive(
                '[aria-label="Search Pebble Crew"],[aria-label="Open navigation"]',
                searchReturn.current,
              )
            }
            open={overlay.kind === 'search'}
            onClose={() => setOverlay({ kind: 'none' })}
            pebbles={pebbles}
            onOpen={(p) => {
              openPebble(p);
              setOverlay({ kind: 'none' });
            }}
          />
          <ExistingOverlay
            open={overlay.kind === 'existing'}
            onClose={() => setOverlay({ kind: 'none' })}
            onAdd={(items) => {
              setPebbles((old) => [
                ...old,
                ...items.filter((item) => !old.some((p) => p.id === item.id)),
              ]);
              setOrganization((current) =>
                items.reduce(
                  (org, item) =>
                    placePebble(org, item.id, { kind: 'section', id: org.sections[0]!.id }),
                  current,
                ),
              );
              setOverlay({ kind: 'none' });
            }}
          />
          <EditorOverlay
            state={overlay}
            onClose={() => setOverlay({ kind: 'none' })}
            onSave={(pebble) => {
              setPebbles((items) => items.map((p) => (p.id === pebble.id ? pebble : p)));
              if (selected.id === pebble.id) setSelected(pebble);
              setOverlay({ kind: 'none' });
            }}
          />
          <Dialog
            open={overlay.kind === 'create'}
            onOpenChange={(open) => {
              if (!open) setOverlay({ kind: 'none' });
            }}
          >
            <DialogContent
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                focusLive('[aria-label="New"],[aria-label="Open navigation"]');
              }}
            >
              <DialogHeader>
                <DialogTitle>Create pebble</DialogTitle>
                <DialogDescription>
                  This screen demonstrates the shared form controls. It does not create a Hermes
                  profile.
                </DialogDescription>
              </DialogHeader>
              <Label htmlFor="create-name">Name</Label>
              <Input id="create-name" placeholder="Pebble name" />
              <Label htmlFor="create-role">Role</Label>
              <Textarea id="create-role" rows={3} />
              <div className="review-form-footer">
                <Button variant="ghost" onClick={() => setOverlay({ kind: 'none' })}>
                  Cancel
                </Button>
                <Button onClick={() => setOverlay({ kind: 'none' })}>Done</Button>
              </div>
            </DialogContent>
          </Dialog>
          <OrganizationDialog
            editor={overlay.kind === 'organize' ? overlay.editor : null}
            org={organization}
            onChange={setOrganization}
            onClose={() => setOverlay({ kind: 'none' })}
          />
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}

function Message({ message }: { message: ReviewMessage }) {
  const [copied, setCopied] = useState(false);
  const reduced = useReducedMotion();
  const at = new Date(message.at);
  return (
    <motion.article
      data-message-id={message.id}
      className={`review-message ${message.role}`}
      initial={message.fresh && !reduced ? { opacity: 0.4, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: easing }}
    >
      <div className="review-bubble">
        {message.text.split('\n\n').map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <div className="review-message-meta">
          <time dateTime={at.toISOString()}>
            {at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </time>
          {message.role === 'user' && <CheckCheck aria-label="Sent in preview" />}
        </div>
      </div>
      <div className="review-message-actions">
        <IconAction
          label={copied ? 'Copied' : 'Copy message'}
          icon={copied ? Check : Copy}
          onClick={() => {
            void navigator.clipboard.writeText(message.text).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        />
      </div>
    </motion.article>
  );
}

function Details({
  pebble,
  onClose,
  onEdit,
}: {
  pebble: Pebble;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [routines, setRoutines] = useState([true, true, false]);
  return (
    <aside className="review-details details-panel" aria-label={`${pebble.name} details`}>
      <header>
        <IconAction label="Close details" icon={X} onClick={onClose} />
      </header>
      <div className="review-details-identity">
        <Face pebble={pebble} large />
        <h2 tabIndex={-1}>{pebble.name}</h2>
        <p>{pebble.title}</p>
        <small>@{pebble.name.toLowerCase()}</small>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit pebble
        </Button>
      </div>
      <Tabs defaultValue="routines">
        <TabsList variant="line">
          <TabsTrigger value="routines">Routines</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="routines" className="review-routines">
          {['Morning briefing', 'Weekly crew review', 'Research digest'].map((name, i) => (
            <div className="review-routine" key={name}>
              <div>
                <h3>{name}</h3>
                <p>{['Weekdays at 8:00 AM', 'Mondays at 9:00 AM', 'Fridays at 3:00 PM'][i]}</p>
              </div>
              <Switch
                checked={routines[i]}
                onCheckedChange={(checked) =>
                  setRoutines((list) => list.map((v, j) => (j === i ? checked : v)))
                }
                aria-label={name}
              />
            </div>
          ))}
        </TabsContent>
        <TabsContent value="files">
          <div className="review-file">
            <FileText />
            <span>
              <strong>Launch brief.pdf</strong>
              <small>Shared today · 284 KB</small>
            </span>
          </div>
          <p className="review-muted text-xs">
            Sample file · downloads are unavailable in this preview.
          </p>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function CrewDetails({
  crew,
  members,
  onClose,
  onEdit,
  onOpen,
}: {
  crew: Crew;
  members: Pebble[];
  onClose: () => void;
  onEdit: () => void;
  onOpen: (pebble: Pebble) => void;
}) {
  return (
    <aside className="review-details details-panel" aria-label={`${crew.name} details`}>
      <header>
        <IconAction label="Close details" icon={X} onClick={onClose} />
      </header>
      <div className="review-details-identity">
        <span className="review-crew-faces review-crew-faces-large">
          {members.slice(0, 2).map((member) => (
            <span key={member.id}>
              <Face pebble={member} />
            </span>
          ))}
          {!members.length && <Users />}
        </span>
        <h2 tabIndex={-1}>{crew.name}</h2>
        <p>{crew.purpose}</p>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Crew settings
        </Button>
      </div>
      <Tabs defaultValue="pebbles">
        <TabsList variant="line">
          <TabsTrigger value="pebbles">Pebbles</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="pebbles">
          <div className="review-crew-roster">
            {members.map((member) => (
              <button key={member.id} onClick={() => onOpen(member)}>
                <Face pebble={member} />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.title}</small>
                </span>
              </button>
            ))}
            {!members.length && (
              <p className="review-muted">Move pebbles into this crew from their three-dot menu.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="files">
          <p className="review-muted">Files shared in this crew will appear here.</p>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function SearchOverlay({
  open,
  onClose,
  pebbles,
  onOpen,
  onRestoreFocus,
}: {
  open: boolean;
  onClose: () => void;
  pebbles: Pebble[];
  onOpen: (p: Pebble) => void;
  onRestoreFocus: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="review-search"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <DialogTitle className="sr-only">Search Pebble Crew</DialogTitle>
        <DialogDescription className="sr-only">
          Synthetic search results demonstrate pebbles, messages, files and routines. Live system
          search is not implemented in this preview.
        </DialogDescription>
        <Command>
          <CommandInput placeholder="Search Pebble Crew…" aria-label="Search Pebble Crew" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Pebbles">
              {pebbles.slice(0, 4).map((pebble) => (
                <CommandItem
                  key={pebble.id}
                  value={`${pebble.name} ${pebble.title}`}
                  onSelect={() => onOpen(pebble)}
                >
                  <Face pebble={pebble} />
                  <span>
                    <strong>{pebble.name}</strong>
                    <small>{pebble.title}</small>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Messages">
              <CommandItem
                value="launch brief focus conversation recommendation"
                onSelect={() => onOpen(pebbles[0]!)}
              >
                <FileText />
                <span>
                  <strong>The launch brief is ready</strong>
                  <small>Arlo · Today</small>
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Files & routines">
              <CommandItem value="Launch brief.pdf launch file" onSelect={onClose}>
                <File />
                <span>Launch brief.pdf</span>
              </CommandItem>
              <CommandItem value="Morning briefing routine schedule" onSelect={onClose}>
                <Folder />
                <span>Morning briefing</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <footer className="review-search-footer">
            <span>Sample results</span>
            <span>↑↓ Navigate · ↵ Open · Esc Close</span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <section className="review-settings" aria-label="Settings">
      <header className="review-settings-header">
        <h1>Settings</h1>
        <IconAction label="Close Settings" icon={X} onClick={onClose} />
      </header>
      <Tabs defaultValue="account" className="review-settings-layout">
        <TabsList variant="line">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>
        <div className="review-settings-body">
          <TabsContent value="account">
            <h2>Your account</h2>
            <p className="review-muted">Manage this Pebble Crew installation.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSaved(true);
              }}
            >
              <div className="review-fields">
                <div>
                  <Label htmlFor="owner-name">Name</Label>
                  <Input id="owner-name" defaultValue="Alex" autoComplete="off" />
                </div>
                <div>
                  <Label htmlFor="owner-email">Email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    defaultValue="alex@example.com"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="review-form-footer">
                {saved && <span role="status">Saved in this preview</span>}
                <Button type="submit">Save changes</Button>
              </div>
            </form>
            <section className="review-setting-section">
              <h3>Password</h3>
              <p className="review-muted">Keep access to your installation secure.</p>
              <Button variant="outline" onClick={() => setSaved(true)}>
                Change password
              </Button>
            </section>
          </TabsContent>
          <TabsContent value="appearance">
            <h2>Appearance</h2>
            <p className="review-muted">One theme across your crew.</p>
            <div className="review-settings-row">
              <Label htmlFor="review-theme">Theme</Label>
              <Select defaultValue="dark">
                <SelectTrigger id="review-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="review-settings-row">
              <div>
                <Label htmlFor="review-motion">Avatar motion</Label>
                <p className="review-muted">Follows your device’s reduced-motion setting.</p>
              </div>
              <Switch id="review-motion" defaultChecked />
            </div>
          </TabsContent>
          <TabsContent value="connections">
            <h2>Connections</h2>
            <p className="review-muted">Services your pebbles can use.</p>
            <div className="review-service">
              <span className="review-service-icon">
                <Folder />
              </span>
              <div>
                <h3>GitHub</h3>
                <p className="review-muted">Repositories and issues</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Connect
              </Button>
            </div>
            <p className="review-muted text-xs">
              Service connections are not available in this design preview.
            </p>
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}

function ExistingOverlay({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: Pebble[]) => void;
}) {
  const [query, setQuery] = useState(''),
    [chosen, setChosen] = useState<string[]>([]);
  const available = [
    'Lumen',
    'Indigo',
    'Fern',
    'Quinn',
    'Sol',
    'Wren',
    'Luca',
    'Juno',
    'Piper',
    'Ivo',
    'Remy',
    'Noa',
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="review-existing"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusLive('[aria-label="New"],[aria-label="Open navigation"]');
        }}
      >
        <DialogHeader>
          <DialogTitle>Add existing pebbles</DialogTitle>
          <DialogDescription>
            Your existing Hermes agents, with their personality and memory.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          aria-label="Find an existing agent"
          placeholder="Find an agent…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="review-existing-list">
          {available
            .map((name, index) => ({ name, index }))
            .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
            .map(({ name, index: i }) => (
              <label key={name} className="review-existing-item">
                <AgentAvatar
                  id={`existing-${name}`}
                  look={{
                    kind: 'shape',
                    shape: SHAPES[i % 5]!,
                    color: COLORS[i % COLORS.length]!.id,
                  }}
                />
                <span>
                  <strong>{name}</strong>
                  <small>
                    @{name.toLowerCase()} · {['Research', 'Operations', 'Writing'][i % 3]}
                  </small>
                </span>
                <Checkbox
                  checked={chosen.includes(name)}
                  onCheckedChange={(checked) =>
                    setChosen((items) =>
                      checked === true ? [...items, name] : items.filter((n) => n !== name),
                    )
                  }
                  aria-label={`Add ${name}`}
                />
              </label>
            ))}
        </div>
        <footer className="review-selection-footer">
          <span>{chosen.length ? `${chosen.length} selected` : 'Choose pebbles to add'}</span>
          <Button
            disabled={!chosen.length}
            onClick={() => {
              onAdd(
                chosen.map((name, i) => ({
                  id: `added-${name}`,
                  name,
                  title: 'Team member',
                  preview: 'Start a conversation',
                  look: { kind: 'shape', shape: SHAPES[i % 5]!, color: 'iris' },
                  pinned: false,
                })),
              );
              setChosen([]);
            }}
          >
            Add {chosen.length || ''} {chosen.length === 1 ? 'pebble' : 'pebbles'}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function EditorOverlay({
  state,
  onClose,
  onSave,
}: {
  state: Overlay;
  onClose: () => void;
  onSave: (pebble: Pebble) => void;
}) {
  const pebble = state.kind === 'edit' ? state.pebble : null;
  const returnLabel = useRef('');
  if (pebble) returnLabel.current = `Actions for ${pebble.name}`;
  const [name, setName] = useState(''),
    [title, setTitle] = useState(''),
    [look, setLook] = useState<Appearance>({ kind: 'shape', shape: 'pebble', color: 'iris' });
  const photoInput = useRef<HTMLInputElement>(null);
  const photoGeneration = useRef(0);
  const [photo, setPhoto] = useState(''),
    [photoError, setPhotoError] = useState('');
  useEffect(() => {
    photoGeneration.current++;
    if (pebble) {
      setPhoto(pebble.photo ?? '');
      setPhotoError('');
      setName(pebble.name);
      setTitle(pebble.title);
      setLook(pebble.look);
    }
    return () => {
      photoGeneration.current++;
    };
  }, [pebble]);
  return (
    <Dialog
      open={!!pebble}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="review-editor"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusLive(
            `[aria-label="${CSS.escape(returnLabel.current)}"],[aria-label="Open navigation"]`,
          );
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit {pebble?.name}</DialogTitle>
          <DialogDescription className="sr-only">Profile, appearance and role.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="profile">
          <TabsList variant="line">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="role">Role</TabsTrigger>
            <TabsTrigger value="tools">Tools & skills</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <div className="review-editor-profile">
              <div className="review-avatar-editor appearance-picker">
                <AgentAvatar id="review-appearance" look={look} photo={photo} large />
                <div className="review-shapes">
                  {SHAPES.map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      aria-label={`${shape} shape`}
                      aria-pressed={look.shape === shape}
                      onClick={() => setLook({ ...look, kind: 'shape', shape })}
                    >
                      <AgentAvatar id={`shape-${shape}`} look={{ ...look, kind: 'shape', shape }} />
                    </button>
                  ))}
                </div>
                <div className="review-colors">
                  {COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      style={{ background: color.hex }}
                      aria-label={`${color.label} color`}
                      aria-pressed={look.color === color.id}
                      onClick={() => setLook({ ...look, color: color.id })}
                    />
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => photoInput.current?.click()}>
                  <Image />
                  Use a photo
                </Button>
                <input
                  ref={photoInput}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Choose avatar photo"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const generation = ++photoGeneration.current;
                    void previewPhoto(file)
                      .then((data) => {
                        if (generation !== photoGeneration.current) return;
                        setPhoto(data);
                        setPhotoError('');
                        setLook((value) => ({ ...value, kind: 'photo' }));
                      })
                      .catch(() => {
                        if (generation === photoGeneration.current)
                          setPhotoError('Choose a PNG, JPEG or WebP photo smaller than 5 MB.');
                      });
                  }}
                />
                {photoError && (
                  <p role="alert" className="text-xs text-destructive">
                    {photoError}
                  </p>
                )}
              </div>
              <div className="review-fields">
                <div>
                  <Label htmlFor="pebble-name">Name</Label>
                  <Input id="pebble-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pebble-handle">Handle</Label>
                  <Input id="pebble-handle" defaultValue={pebble?.name.toLowerCase()} />
                </div>
                <div>
                  <Label htmlFor="pebble-title">Title</Label>
                  <Input
                    id="pebble-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="role">
            <div className="review-fields">
              <div>
                <Label htmlFor="pebble-description">Description</Label>
                <Textarea
                  id="pebble-description"
                  rows={3}
                  placeholder="What this pebble is responsible for"
                />
              </div>
              <div>
                <Label htmlFor="pebble-reports">Reports to</Label>
                <Select defaultValue="arlo">
                  <SelectTrigger id="pebble-reports">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="arlo">Arlo · Main Pebble</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="tools">
            <div className="review-settings-row">
              <Label htmlFor="tool-browser">Browser</Label>
              <Switch id="tool-browser" defaultChecked />
            </div>
            <div className="review-settings-row">
              <Label htmlFor="tool-files">Files</Label>
              <Switch id="tool-files" defaultChecked />
            </div>
          </TabsContent>
        </Tabs>
        <div className="review-form-footer">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              if (pebble) onSave({ ...pebble, name: name.trim(), title, look, photo });
            }}
          >
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
