import { useEffect, useState } from 'react';
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
/** Explicit user scrolling only. History restoration deliberately does not use this. */
export function scrollToLatest(
  node: HTMLElement,
  onDone: () => void,
  onCancel: () => void = () => {},
) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.scrollTop = node.scrollHeight;
    onDone();
    return () => {};
  }
  const start = node.scrollTop,
    began = performance.now();
  let frame = 0,
    stopped = false;
  const cancel = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    cleanup();
    onCancel();
  };
  const cleanup = () => {
    node.removeEventListener('wheel', cancel);
    node.removeEventListener('touchstart', cancel);
    node.removeEventListener('keydown', cancel);
  };
  node.addEventListener('wheel', cancel, { passive: true });
  node.addEventListener('touchstart', cancel, { passive: true });
  node.addEventListener('keydown', cancel);
  const step = (now: number) => {
    if (stopped) return;
    const t = Math.min(1, (now - began) / 240);
    node.scrollTop =
      start + (node.scrollHeight - node.clientHeight - start) * (1 - Math.pow(1 - t, 3));
    if (t < 1) frame = requestAnimationFrame(step);
    else {
      cleanup();
      onDone();
    }
  };
  frame = requestAnimationFrame(step);
  return cancel;
}
