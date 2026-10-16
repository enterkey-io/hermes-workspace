import { useEffect, useRef } from 'react';
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

export function useOverlayHistory(open: boolean, close: () => boolean | void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => (open ? openOverlay(() => ref.current()) : undefined), [open]);
}
