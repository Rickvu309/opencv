import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";

export function useRailHighlight(layoutKey: string) {
  const navRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const targetKey = hovered;

  function setItemRef(key: string) {
    return (el: HTMLElement | null) => {
      itemRefs.current[key] = el;
    };
  }

  function hoverProps(key: string) {
    return {
      onPointerEnter: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse") setHovered(key);
      },
      onFocus: () => setHovered(key),
      onBlur: () => setHovered(null),
    };
  }

  useLayoutEffect(() => {
    const container = navRef.current;
    const target = targetKey ? itemRefs.current[targetKey] : null;
    if (!container || !target) {
      setBox(null);
      return;
    }
    const cr = container.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    if (tr.bottom <= cr.top || tr.top >= cr.bottom) {
      setBox(null);
      return;
    }
    setBox({
      top: Math.round(tr.top - cr.top),
      height: Math.round(tr.height),
    });
  }, [targetKey, layoutKey, scrollTick]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => setScrollTick((n) => n + 1);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => setScrollTick((n) => n + 1));
    if (navRef.current) ro.observe(navRef.current);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  return {
    navRef,
    scrollRef,
    box,
    hovered,
    setItemRef,
    hoverProps,
    setHovered,
    clearHover: () => setHovered(null),
  };
}
