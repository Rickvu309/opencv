"use client"

import type { CSSProperties, ReactNode } from "react"

export type SkeletonProps = {
  width?: number | string
  height?: number | string
  radius?: number | string
  circle?: boolean
  className?: string
  style?: CSSProperties
}

export type ShimmerTextProps = {
  children: ReactNode
  durationSeconds?: number
  className?: string
}

const len = (v: number | string | undefined) =>
  typeof v === "number" ? `${v}px` : v

const Style = () => (
  <style href="ui-shimmer-loader" precedence="default">
    {css}
  </style>
)

export function Skeleton({
  width,
  height,
  radius,
  circle,
  className,
  style,
}: SkeletonProps) {
  const w = len(width)
  return (
    <>
      <Style />
      <span
        data-slot="shimmer-skeleton"
        className={["ui-shm", className].filter(Boolean).join(" ")}
        aria-hidden="true"
        style={{
          width: w,
          height: circle ? (w ?? len(height)) : len(height),
          borderRadius: circle ? "50%" : len(radius),
          ...style,
        }}
      />
    </>
  )
}

export function ShimmerText({
  children,
  durationSeconds = 2,
  className,
}: ShimmerTextProps) {
  return (
    <>
      <Style />
      <span
        data-slot="shimmer-text"
        className={["ui-shm-text", className].filter(Boolean).join(" ")}
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {children}
      </span>
    </>
  )
}

const css = `
.ui-shm {
  display: block;
  flex: none;
  width: 100%;
  height: 12px;
  max-width: 100%;
  border-radius: 6px;
  background-color: var(--muted);
  background-image: linear-gradient(
    100deg,
    transparent 0%,
    transparent 30%,
    color-mix(in oklab, var(--background) 70%, transparent) 50%,
    transparent 70%,
    transparent 100%
  );
  background-size: 150vw 100%;
  background-repeat: repeat-x;
  background-attachment: fixed;
  animation: ui-shm-sweep 2.2s linear infinite;
}
@keyframes ui-shm-sweep {
  from { background-position: -50vw 0; }
  to { background-position: 100vw 0; }
}

.ui-shm-text {
  display: inline-block;
  color: var(--muted-foreground);
  background-image: linear-gradient(
    90deg,
    var(--muted-foreground) 0%,
    var(--muted-foreground) 40%,
    var(--foreground) 50%,
    var(--muted-foreground) 60%,
    var(--muted-foreground) 100%
  );
  background-size: 300% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ui-shm-text 2s linear infinite;
}
@keyframes ui-shm-text {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .ui-shm { animation: none; background-image: none; }
  .ui-shm-text { animation: none; background-image: none; -webkit-text-fill-color: currentColor; }
}
`
