import type { ReactNode } from "react";

export default class Lenis {
  destroy() {}
  raf(_time: number) {}
}

export function ReactLenis({ children }: { children?: ReactNode }) {
  return children;
}

export function useLenis() {
  return null;
}
