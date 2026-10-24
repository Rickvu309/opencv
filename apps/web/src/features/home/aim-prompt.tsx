import { Button } from "@workspace/ui/components/button"

import { AIM_OPTIONS, type AimId } from "@/features/home/aim-prompt.ts"

export function AimPrompt({
  visible,
  options,
  onSkip,
  onChoose,
}: {
  visible: boolean
  options: typeof AIM_OPTIONS
  onSkip: () => void
  onChoose: (id: AimId) => void
}) {
  if (!visible) return null

  return (
    <section
      aria-labelledby="aim-prompt-heading"
      className="w-full max-w-md rounded-xl border border-border/70 bg-background px-4 py-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="aim-prompt-heading"
            className="text-sm font-medium tracking-tight"
          >
            What are you aiming for?
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional. Skip whenever.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={onSkip}
        >
          Skip
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full"
            onClick={() => onChoose(option.id)}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-muted-foreground"
          onClick={onSkip}
        >
          I'm not sure yet
        </Button>
      </div>
    </section>
  )
}
