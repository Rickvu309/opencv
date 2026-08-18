import { cvSections, type CvSection, type PaperContent } from "@/features/paper/model";
import { cn } from "@/lib/utils";

const sectionLabel: Record<CvSection, string> = {
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  proof: "Proof",
};

export function FormatBar({
  content,
  completeness,
  showSections = true,
  onDensity,
  onSection,
}: {
  content: PaperContent;
  completeness?: string;
  showSections?: boolean;
  onDensity: (density: "normal" | "tight") => void;
  onSection: (section: CvSection, hidden: boolean) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Format"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-2"
    >
      <div className="flex flex-wrap gap-1" role="group" aria-label="Density">
        {(["normal", "tight"] as const).map((density) => (
          <button
            key={density}
            type="button"
            aria-pressed={content.density === density}
            onClick={() => onDensity(density)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[13px]",
              content.density === density
                ? "bg-surface-3 text-ink"
                : "text-ink-muted hover:bg-surface-2",
            )}
          >
            {density === "normal" ? "Normal" : "Tight"}
          </button>
        ))}
      </div>
      {showSections ? (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sections">
          {cvSections.map((section) => {
            const shown = !content.hidden[section];
            return (
              <button
                key={section}
                type="button"
                aria-pressed={shown}
                onClick={() => onSection(section, shown)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[13px]",
                  shown ? "bg-surface-3 text-ink" : "text-ink-muted hover:bg-surface-2",
                )}
              >
                {sectionLabel[section]}
              </button>
            );
          })}
        </div>
      ) : null}
      {completeness ? (
        <p className="min-w-0 flex-1 basis-full text-[13px] leading-[1.5] text-ink-muted tabular-nums sm:basis-auto">
          {completeness}
        </p>
      ) : null}
    </div>
  );
}
