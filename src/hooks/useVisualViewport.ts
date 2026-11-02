import { useEffect, useState } from 'react';

// Mobile keyboards don't change the *layout* viewport on iOS — only the visual viewport shrinks —
// so `height: 100%` and `@media (max-height)` never notice the keyboard and the bottom of the app
// (Show answer, tab bar, Log in) ends up underneath it. This hook reports the visual viewport
// height so the app root can size itself to the area the keyboard leaves free, plus a
// `keyboardOpen` flag for layout decisions (hide the tab bar, compress Study spacing).
// It also mirrors the flag onto <html class="kb-open"> so index.css can react (inline styles
// can't use media queries, and no media query fires for the iOS keyboard anyway).
export interface VisualViewport {
  height: number | null; // null when the API is unavailable (old browsers) → fall back to 100%
  keyboardOpen: boolean;
}

// Keyboard detection: a text field has focus AND the visual viewport lost a keyboard's worth of
// height. The baseline is `screen.height` (fixed for the device) rather than `innerHeight`, which
// iOS Safari *partially* shrinks when the keyboard shows — comparing against it under-reports the
// gap and misses the keyboard. Browser chrome alone (status bar + Safari toolbar) costs ~130px on
// an iPhone; the shortest keyboard adds well over 250px.
const KEYBOARD_MIN_PX = 250;

const TOUCH = window.matchMedia('(pointer: coarse)');

function textFieldFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useVisualViewport(): VisualViewport {
  const [vv, setVv] = useState<VisualViewport>({ height: null, keyboardOpen: false });

  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Pinch-zoom also shrinks the visual viewport; don't re-layout for that — keep the last
        // unzoomed height (iOS reports scale slightly ≠ 1 at rest, hence the tolerance).
        if (Math.abs(v.scale - 1) > 0.01) return;
        const height = Math.round(v.height);
        // Touch devices only: on a desktop a non-maximised window is also far shorter than the
        // screen, and Study's answer box always has focus there.
        const keyboardOpen = TOUCH.matches && textFieldFocused() && window.screen.height - height > KEYBOARD_MIN_PX;
        document.documentElement.classList.toggle('kb-open', keyboardOpen);
        setVv({ height, keyboardOpen });
        // The app never scrolls at page level (html/body/#root are 100%; screens scroll inside
        // <main>), but iOS pans the layout viewport to reveal a focused field. With the root sized
        // to the visual viewport that pan just hides the top of the app and leaves a blank strip
        // at the bottom — pin it back.
        if (window.scrollY !== 0 || v.offsetTop !== 0) window.scrollTo(0, 0);
      });
    };
    update();
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    // Focus changes don't fire visualViewport events but flip the keyboard flag.
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      document.documentElement.classList.remove('kb-open');
    };
  }, []);

  return vv;
}
