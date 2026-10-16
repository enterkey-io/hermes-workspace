import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
type OverlayHistory = {
  token: string;
  pushed: boolean;
  popped: boolean;
  back: () => boolean | void;
};
const overlayStack: OverlayHistory[] = [];
const closedTokens = new Set<string>();
let movingBack = false;
function openOverlay(back: () => boolean | void) {
  const entry: OverlayHistory = { token: crypto.randomUUID(), pushed: false, popped: false, back };
  overlayStack.push(entry);
  if (!movingBack) {
    history.pushState({ pebbleDrawer: entry.token }, '');
    entry.pushed = true;
  }
  return () => {
    const index = overlayStack.indexOf(entry);
    if (index >= 0) overlayStack.splice(index, 1);
    closedTokens.add(entry.token);
    if (closedTokens.size > 100) closedTokens.delete(closedTokens.values().next().value!);
    if (!entry.popped && entry.pushed && history.state?.pebbleDrawer === entry.token) {
      movingBack = true;
      history.back();
    }
  };
}
window.addEventListener('popstate', () => {
  const token = history.state?.pebbleDrawer;
  if (movingBack || closedTokens.has(token)) {
    movingBack = false;
    if (closedTokens.has(token)) {
      movingBack = true;
      history.back();
      return;
    }
    const entry = overlayStack.at(-1);
    if (entry && !entry.pushed) {
      history.pushState({ pebbleDrawer: entry.token }, '');
      entry.pushed = true;
    }
    return;
  }
  const entry = overlayStack.at(-1);
  if (entry && token !== entry.token) {
    entry.popped = true;
    if (entry.back() === false) {
      entry.popped = false;
      history.pushState({ pebbleDrawer: entry.token }, '');
    }
  }
});
const focusable =
  'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]';
export function Drawer({
  title,
  children,
  onClose,
  variant = 'drawer',
}: {
  title: string;
  children: ReactNode;
  onClose: () => boolean | void;
  variant?: 'drawer' | 'dialog';
}) {
  const ref = useRef<HTMLDivElement>(null),
    backdrop = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLeaving(false);
      close.current();
    } else
      timer.current = setTimeout(() => {
        setLeaving(false);
        close.current();
      }, 180);
  };
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const siblings = [...document.body.children].filter(
      (n) => n !== backdrop.current,
    ) as HTMLElement[];
    const prior = siblings.map((n) => n.inert);
    siblings.forEach((n) => {
      n.inert = true;
    });
    const node = ref.current!;
    (node.querySelector<HTMLElement>(focusable) ?? node).focus();
    const key = (e: KeyboardEvent) => {
      if (backdrop.current?.inert) return;
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        dismissRef.current();
      }
      if (e.key === 'Tab') {
        const all = [...node.querySelectorAll<HTMLElement>(focusable)].filter(
          (n) => n.getClientRects().length,
        );
        const first = all[0],
          last = all.at(-1);
        if (!first) {
          e.preventDefault();
          node.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const contain = (e: FocusEvent) => {
      if (!backdrop.current?.inert && !node.contains(e.target as Node))
        (node.querySelector<HTMLElement>(focusable) ?? node).focus();
    };
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', contain);
    const clearHistory = openOverlay(() => close.current());
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('keydown', key);
      document.removeEventListener('focusin', contain);
      clearHistory();
      siblings.forEach((n, i) => {
        n.inert = prior[i]!;
      });
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus();
      else document.querySelector<HTMLElement>('.chat-header button,.rail-toolbar button')?.focus();
    };
  }, []);
  return createPortal(
    <div
      ref={backdrop}
      className={`drawer-backdrop ${leaving ? 'is-leaving' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`chat-drawer ${variant === 'dialog' ? 'ui-dialog' : ''}`}
      >
        <button
          type="button"
          className="icon-button drawer-close"
          aria-label={`Close ${title}`}
          onClick={dismiss}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
