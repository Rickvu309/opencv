import { templates, letterSituations } from "@/features/paper/model";
import { Button } from "@/ui/button";

export function SituationGallery({
  kind,
  onPick,
  onCancel,
}: {
  kind: "cv" | "letter";
  onPick: (id: string) => void;
  onCancel?: () => void;
}) {
  const heading = kind === "cv" ? "Where is this CV going?" : "Who is this letter for?";
  const items =
    kind === "cv"
      ? templates.map((t) => ({ id: t.id, label: t.label, word: t.word }))
      : letterSituations.map((s) => ({ id: s.id, label: s.label, word: "Cover letter" as const }));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-balance text-[18px] font-[510] leading-[1.4] tracking-[-0.012em]">
          {heading}
        </h2>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Back to the list
          </Button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="min-h-11 rounded-[var(--radius-container)] border border-hairline p-4 text-left transition-[background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2 focus-visible:shadow-[var(--focus-ring)] active:scale-[0.97] active:bg-surface-3"
            onClick={() => onPick(item.id)}
          >
            <span className="block text-[13px] whitespace-nowrap text-ink-muted">{item.word}</span>
            <span className="mt-1 block text-[15px] font-[510] leading-[1.5] tracking-[-0.012em]">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
