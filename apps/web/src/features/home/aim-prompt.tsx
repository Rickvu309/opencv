import { Button } from "@workspace/ui/components/button"

import { useAimPrompt } from "@/features/home/use-aim-prompt.ts"

export function AimPrompt() {
  const { visible, options, skip, choose } = useAimPrompt()

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
            className="font-heading text-sm font-medium tracking-tight"
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
          onClick={skip}
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
            onClick={() => choose(option.id)}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-muted-foreground"
          onClick={skip}
        >
          I'm not sure yet
        </Button>
      </div>
    </section>
  )
}
