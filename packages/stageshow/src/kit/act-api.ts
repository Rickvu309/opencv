import type { Dispatch, SetStateAction } from "react"
import type { CursorKind } from "./cursor.tsx"
import type { Keys } from "./keys.tsx"
import type { Layout } from "./looks.ts"
import type { Point, Rect, Target } from "./measure.ts"

export interface Act<S> {
  set(patch: Partial<S> | ((s: S) => Partial<S>)): Promise<void>
  put(patch: Partial<S> | ((s: S) => Partial<S>)): void
  wait(ms: number): Promise<void>
  rect(name: string, opts?: { layout?: boolean }): Rect
  caret(name: string, at: Point): number
  center(name: string): Point
  move(
    to: Target,
    opts?: {
      duration?: number
      path?: (progress: number, from: Point, to: Point) => Point
      onMove?: (at: Point, from: Point, t: number) => void
    }
  ): Promise<void>
  click(
    to?: Target,
    opts?: { double?: boolean; right?: boolean }
  ): Promise<void>
  scroll(
    name: string,
    to: number | string,
    opts?: { duration?: number; offset?: number }
  ): Promise<void>
  cursor(kind: CursorKind): Promise<void>
  snap(
    patch: Partial<S> | ((s: S) => Partial<S>),
    scope?: string
  ): Promise<void>
  key(combo: string): Promise<void>
  stagger<T>(
    items: T[],
    fn: (item: T, i: number) => Promise<void> | void,
    gap?: number
  ): Promise<void>
  mark(name: string): void
  type(key: keyof S, text: string, opts?: { interval?: number }): Promise<void>
  drag(
    to: Target,
    onMove?: (at: Point, from: Point, t: number) => void,
    opts?: {
      duration?: number
      cursor?: "preserve"
      path?: (progress: number, from: Point, to: Point) => Point
    }
  ): Promise<void>
  place(to: Target): void
  enter(to: Target, opts?: { duration?: number }): Promise<void>
  readonly signal: AbortSignal
  readonly layout: Layout
}

export type Script<S> = (act: Act<S>) => Promise<void>

type Ref<T> = { current: T }

export interface ActEnv<S> {
  rootRef: { readonly current: HTMLDivElement | null }
  cursorRef: { readonly current: HTMLDivElement | null }
  pos: Ref<Point>
  hovered: Ref<Element | null>
  kindRef: Ref<CursorKind>
  keysRef: Ref<Keys>
  dragging: Ref<boolean>
  autoUsed: Ref<boolean>
  autoRef: Ref<((p: Point) => void) | null>
  scaleRef: Ref<number>
  speed: number
  layout: Layout
  cursor?: { ripple?: boolean; style?: string }
  resolve: (t: Target) => Point
  place: (p: Point) => void
  remeasure: () => void
  ripple: (at: Point) => void
  setState: Dispatch<SetStateAction<S>>
  setKind: Dispatch<SetStateAction<CursorKind>>
  setKeys: Dispatch<SetStateAction<Keys>>
  setLastKeys: Dispatch<SetStateAction<Keys | null>>
}
