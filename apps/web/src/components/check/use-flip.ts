"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

const reduced = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * FLIP: after each render, any card that changed place glides from where it was. `cards` maps an id to
 * its element; returns the cards' latest rects for placing agent cursors.
 */
export function useFlip<K>(
  cards: RefObject<Map<K, HTMLElement>>,
  /** Changes whenever cards may have moved (a snapshot or a key string) */
  layout: unknown,
): RefObject<Map<K, DOMRect>> {
  const rects = useRef(new Map<K, DOMRect>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: `layout` is the trigger; cards are read from the ref
  useLayoutEffect(() => {
    const still = reduced();
    for (const [id, el] of cards.current) {
      const now = el.getBoundingClientRect();
      const was = rects.current.get(id);
      rects.current.set(id, now);
      if (!was || still) continue;
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1.04)` },
          { transform: "translate(0, 0) scale(1)" },
        ],
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  }, [layout, cards]);
  return rects;
}
