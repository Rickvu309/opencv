"use client";

import * as React from "react";

import {
  CAT_BODY,
  CAT_MASCOT_DEFAULT_PLAYING,
  CAT_MASCOT_DEFAULT_STAGE,
  CAT_MASCOT_DEFAULT_USE_CASE,
  CAT_MASCOT_PLAY_MS,
  clampCatStage,
  resolveCatMascotFrame,
  type CatExtra,
  type CatPose,
  type CatUseCase,
} from "@/lib/coach/cat-mascot";
import { cn } from "@/lib/utils";

import styles from "./cat-mascot.module.css";

export type {
  CatExtra,
  CatMouth,
  CatPose,
  CatUseCase,
  CatUseCaseEntry,
} from "@/lib/coach/cat-mascot";
export {
  CAT_MASCOT_CATALOG,
  CAT_STAGE_COUNT,
  CAT_USE_CASES,
} from "@/lib/coach/cat-mascot";

export type CatMascotProps = {
  /** Product moment. Defaults to the sleeping Coach greeting. */
  useCase?: CatUseCase;
  /** Frame 0–9. Out of range clamps. Ignored while `playing`. */
  stage?: number;
  /** Cycle stages. Default off; leave off on the Coach greeting. */
  playing?: boolean;
  compact?: boolean;
  className?: string;
};

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

function ExtraGlyph({ extra }: { extra: CatExtra }) {
  switch (extra) {
    case "zzz":
      return (
        <g>
          <text
            className={styles.z}
            x="35"
            y="9"
            fontSize="4.4"
            fontFamily="inherit"
          >
            z
          </text>
          <text
            className={styles.z}
            x="39"
            y="5"
            fontSize="3.6"
            fontFamily="inherit"
          >
            z
          </text>
          <text
            className={styles.z}
            x="42.5"
            y="1.5"
            fontSize="2.9"
            fontFamily="inherit"
          >
            z
          </text>
        </g>
      );
    case "dots":
      return (
        <g className={styles.face}>
          <circle cx="18.5" cy="3.2" r="0.9" />
          <circle cx="22" cy="1.6" r="0.9" />
          <circle cx="25.5" cy="3.2" r="0.9" />
        </g>
      );
    case "page":
      return (
        <g className={styles.stroke}>
          <rect x="36.2" y="12.5" width="7.2" height="9.2" rx="1" />
          <path d="M38 15.2 H41.6 M38 17.4 H41.6 M38 19.6 H40.6" />
        </g>
      );
    case "write":
      return (
        <g className={styles.stroke}>
          <rect x="36.2" y="12.5" width="7.2" height="9.2" rx="1" />
          <path d="M38 15.2 H41.6 M38 17.4 H41.6 M38 19.6 H40.6" />
          <path d="M34.6 23.2 L38.2 15.4" />
        </g>
      );
    case "lens":
      return (
        <g className={styles.stroke}>
          <circle cx="38.2" cy="6.2" r="3.1" />
          <path d="M40.5 8.6 L43.1 11.2" />
        </g>
      );
    case "mark":
      return (
        <g className={styles.stroke}>
          <path d="M36.2 7.2 L39.4 9.4 L36.2 11.6" />
        </g>
      );
    case "check":
      return (
        <g className={styles.stroke}>
          <path d="M35.6 8.4 L37.8 10.6 L42.2 5.4" />
        </g>
      );
    case "dash":
      return (
        <g className={styles.stroke}>
          <path d="M35.8 8 H42.4" />
        </g>
      );
    default:
      return null;
  }
}

function poseTransform(pose: CatPose) {
  return {
    body: `translate(0px, ${pose.headY}px) rotate(${pose.headTilt}deg)`,
    earLeft: `rotate(${pose.earLeft}deg)`,
    earRight: `rotate(${pose.earRight}deg)`,
    whiskers: `translate(0px, ${pose.whisker}px)`,
    eyes: `translate(${pose.lookX}px, ${pose.lookY}px) scale(1, ${pose.eyeScaleY})`,
    extras: `translate(${pose.extraX}px, ${pose.extraY}px)`,
  };
}

/**
 * Line-art cat for empty and waiting surfaces. Defaults to the sleeping
 * greeting; later screens pass a use case and stage from the catalog.
 */
export function CatMascot({
  useCase = CAT_MASCOT_DEFAULT_USE_CASE,
  stage = CAT_MASCOT_DEFAULT_STAGE,
  playing = CAT_MASCOT_DEFAULT_PLAYING,
  compact,
  className,
}: CatMascotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const startStage = clampCatStage(stage);
  const [loopOffset, setLoopOffset] = React.useState(0);
  const [origin, setOrigin] = React.useState({ useCase, startStage, playing });
  if (
    origin.useCase !== useCase ||
    origin.startStage !== startStage ||
    origin.playing !== playing
  ) {
    setOrigin({ useCase, startStage, playing });
    setLoopOffset(0);
  }

  React.useEffect(() => {
    if (!playing || reducedMotion) return;
    const id = window.setInterval(() => {
      setLoopOffset((current) => current + 1);
    }, CAT_MASCOT_PLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, reducedMotion, useCase, startStage]);

  const frame = resolveCatMascotFrame({
    useCase,
    stage,
    playing,
    playHead: startStage + loopOffset,
    reducedMotion,
  });
  const { pose } = frame;
  const transform = poseTransform(pose);

  return (
    <svg
      viewBox={CAT_BODY.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      data-drift={frame.driftZ ? "" : undefined}
      className={cn(
        styles.root,
        "text-muted-foreground",
        compact ? "h-auto w-14" : "h-auto w-20",
        className,
      )}
    >
      <g
        className={styles.extras}
        style={{
          opacity: pose.extra === "none" ? 0 : pose.extraOpacity,
          transform: transform.extras,
        }}
      >
        <ExtraGlyph extra={pose.extra} />
      </g>
      <g className={styles.body} style={{ transform: transform.body }}>
        <g className={styles.stroke}>
          <g className={styles.earLeft} style={{ transform: transform.earLeft }}>
            <path d={CAT_BODY.earLeft} />
          </g>
          <g
            className={styles.earRight}
            style={{ transform: transform.earRight }}
          >
            <path d={CAT_BODY.earRight} />
          </g>
          <path d={CAT_BODY.crown} />
          <path d={CAT_BODY.head} />
          <g
            className={styles.whiskers}
            style={{ transform: transform.whiskers }}
          >
            <path d={CAT_BODY.whiskerLeft} />
            <path d={CAT_BODY.whiskerRight} />
          </g>
          <path
            className={styles.mouthLine}
            d={CAT_BODY.mouthLine}
            style={{ opacity: pose.mouth === "line" ? 1 : 0 }}
          />
          <path
            className={styles.mouthOpen}
            d={CAT_BODY.mouthOpen}
            style={{ opacity: pose.mouth === "open" ? 1 : 0 }}
          />
        </g>
        <g className={styles.face}>
          <g className={styles.eyes} style={{ transform: transform.eyes }}>
            <rect
              x={CAT_BODY.eyeLeft.x}
              y={CAT_BODY.eyeLeft.y}
              width={CAT_BODY.eyeLeft.width}
              height={CAT_BODY.eyeLeft.height}
              rx={CAT_BODY.eyeLeft.rx}
            />
            <rect
              x={CAT_BODY.eyeRight.x}
              y={CAT_BODY.eyeRight.y}
              width={CAT_BODY.eyeRight.width}
              height={CAT_BODY.eyeRight.height}
              rx={CAT_BODY.eyeRight.rx}
            />
          </g>
          <path d={CAT_BODY.nose} />
        </g>
      </g>
    </svg>
  );
}
