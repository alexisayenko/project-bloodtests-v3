import { useEffect, useRef, useState } from 'react';

/** Ignore jitter below this many pixels, so a fixed bar never flickers mid-gesture. */
const THRESHOLD = 10;
/** Within this far from the top the bar is always shown, whatever the last direction was. */
const TOP_ZONE = 4;

/**
 * Whether a fixed bar should be off-screen: true once the page has been
 * scrolled down past the threshold, false again on the first scroll back up
 * and always at the top of the page. Reads scroll position in a rAF so a
 * momentum flick costs one measurement per frame, not one per event.
 */
export function useHideOnScroll(threshold: number = THRESHOLD): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const update = () => {
      frame.current = 0;
      const y = Math.max(0, window.scrollY);
      if (y <= TOP_ZONE) {
        lastY.current = y;
        setHidden(false);
        return;
      }
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      lastY.current = y;
      setHidden(delta > 0);
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [threshold]);

  return hidden;
}
