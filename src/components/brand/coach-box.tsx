import { cn } from "@/lib/utils";

/**
 * The Coach's face: a 2D rounded square with two eyes.
 *
 * She is the Coach, not a package icon. Sit is the default. Listen closes the
 * eyes once (happy U-arcs). Done blinks once. Think is Sit — the typing dots
 * do that work. Reduced motion keeps Sit (or a static fill when `filled`).
 *
 * Both eye sets stay in the SVG so Sit → Listen can morph. The empty-kit
 * greeting opts into a small continuous float (`live`). Chrome marks stay
 * still — swapping keyframes on pose was the jump.
 */
export type CoachBoxPose = "sit" | "listen" | "think" | "done";
export type CoachBoxSize = "sm" | "md" | "lg";

const sizeClass: Record<CoachBoxSize, string> = {
  sm: "size-3.5 -translate-y-px",
  md: "size-4",
  lg: "size-10",
};

export function CoachBox({
  pose = "sit",
  size = "md",
  filled = false,
  live = false,
  className,
  title,
}: {
  pose?: CoachBoxPose;
  size?: CoachBoxSize;
  /** Fill the mark when Coach is the active surface. */
  filled?: boolean;
  /** Empty-kit greeting only. One loop, no pose swap. */
  live?: boolean;
  className?: string;
  title?: string;
}) {
  const eye = filled ? "var(--primary)" : "currentColor";

  return (
    <span
      data-pose={pose}
      className={cn(
        "inline-flex overflow-visible",
        live && "box-mark",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        className={cn(sizeClass[size], "shrink-0 overflow-visible")}
      >
        {title ? <title>{title}</title> : null}
        {/* Soft square — radius ~25% of the face, not a sharp widget. */}
        <rect x="4" y="3.2" width="16" height="16" rx="4.4" />
        {/* Ground tick so the box reads as seated. */}
        <path
          d="M9 21.2h6"
          strokeWidth={filled ? 1.5 : 1.75}
          className="box-ground"
        />
        <g className="box-eyes-open">
          <circle
            cx="9.6"
            cy="12.6"
            r={filled ? 1.15 : 1.05}
            fill={eye}
            stroke="none"
            className="box-eye origin-[9.6px_12.6px]"
          />
          <circle
            cx="14.4"
            cy="12.6"
            r={filled ? 1.15 : 1.05}
            fill={eye}
            stroke="none"
            className="box-eye origin-[14.4px_12.6px]"
          />
          {size === "lg" ? (
            <>
              <circle
                cx="9.25"
                cy="12.2"
                r="0.35"
                fill={filled ? "currentColor" : "var(--background)"}
                stroke="none"
              />
              <circle
                cx="14.05"
                cy="12.2"
                r="0.35"
                fill={filled ? "currentColor" : "var(--background)"}
                stroke="none"
              />
            </>
          ) : null}
        </g>
        <g className="box-eyes-listen">
          <path
            d="M8.4 13.1c.7 1.1 1.7 1.1 2.4 0"
            fill="none"
            stroke={eye}
            strokeWidth={1.6}
          />
          <path
            d="M13.2 13.1c.7 1.1 1.7 1.1 2.4 0"
            fill="none"
            stroke={eye}
            strokeWidth={1.6}
          />
        </g>
      </svg>
    </span>
  );
}
