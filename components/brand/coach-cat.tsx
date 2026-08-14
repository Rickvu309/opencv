import { cn } from "@/lib/utils";

/**
 * The Coach's face. One SVG, currentColor, four poses.
 *
 * She is the Coach, not a second character. Sit is the default. Listen and
 * Done fire once per event. Think is Sit — the typing dots do that work.
 * Reduced motion keeps Sit (or a static fill when `filled`).
 */
export type CoachCatPose = "sit" | "listen" | "think" | "done";
export type CoachCatSize = "sm" | "md" | "lg";

const sizeClass: Record<CoachCatSize, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-10",
};

export function CoachCat({
  pose = "sit",
  size = "md",
  filled = false,
  className,
  title,
}: {
  pose?: CoachCatPose;
  size?: CoachCatSize;
  /** Fill the mark when Coach is the active surface. */
  filled?: boolean;
  className?: string;
  title?: string;
}) {
  const moving = pose === "listen" || pose === "done";

  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn(
        sizeClass[size],
        "shrink-0",
        moving && "motion-safe:cat-pose",
        pose === "listen" && "motion-safe:cat-listen",
        pose === "done" && "motion-safe:cat-done",
        className,
      )}
    >
      {title ? <title>{title}</title> : null}
      {/* Ears — origin at the skull so Listen settles from here. */}
      <path
        d="M7 9.5 5.2 4.8 10 7.2"
        className="origin-[7px_8px] motion-safe:cat-ear-l"
      />
      <path
        d="M17 9.5 18.8 4.8 14 7.2"
        className="origin-[17px_8px] motion-safe:cat-ear-r"
      />
      {/* Head */}
      <circle cx="12" cy="12.2" r="5.4" />
      {/* Eyes — collapse cleanly at 14px */}
      <circle
        cx="10.1"
        cy="11.6"
        r={filled ? 0.7 : 0.55}
        fill={filled ? "var(--primary)" : "currentColor"}
        stroke="none"
        className="motion-safe:cat-eye"
      />
      <circle
        cx="13.9"
        cy="11.6"
        r={filled ? 0.7 : 0.55}
        fill={filled ? "var(--primary)" : "currentColor"}
        stroke="none"
        className="motion-safe:cat-eye"
      />
      {/* Nose */}
      <path d="M12 13.1v1.1" />
      {/* Chest, only needed above chip size — still in the box so lg reads as sitting */}
      <path d="M8.2 16.6c.8 2.2 2.2 3.4 3.8 3.4s3-1.2 3.8-3.4" />
    </svg>
  );
}
