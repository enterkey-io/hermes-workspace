import { useLayoutEffect } from 'react';

export function useAppViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const style = document.documentElement.style;
    let frame = 0;
    const update = () => {
      // Keyboard/browser chrome resize the visible area at scale 1. Pinch zoom
      // must magnify the existing layout rather than resize it to counteract zoom.
      if (viewport.scale !== 1) return;
      style.setProperty('--app-viewport-height', `${viewport.height}px`);
      style.setProperty('--app-viewport-top', `${viewport.offsetTop}px`);
    };
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    update();
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      style.removeProperty('--app-viewport-height');
      style.removeProperty('--app-viewport-top');
    };
  }, []);
}
