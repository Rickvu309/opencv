import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { AimPrompt } from "@/features/home/aim-prompt.tsx"
import { FirstCafeChecklist } from "@/features/home/first-cafe-checklist.tsx"
import { FirstCafeNudge } from "@/features/home/first-cafe-nudge.tsx"
import { useAimPrompt } from "@/features/home/use-aim-prompt.ts"
import { useFirstCafeChecklist } from "@/features/home/use-first-cafe-checklist.ts"

export function HomeStart() {
  const aim = useAimPrompt()
  const cafe = useFirstCafeChecklist({ aimResolved: aim.resolved })
  const [open, setOpen] = useState(false)

  if (!aim.visible && !cafe.visible && !cafe.nudge) return null

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls="home-start"
        onClick={() => setOpen((value) => !value)}
        className="text-muted-foreground"
      >
        Get started
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </Button>
      {open ? (
        <div
          id="home-start"
          className="flex w-full flex-col items-center gap-3"
        >
          <AimPrompt
            visible={aim.visible}
            options={aim.options}
            onSkip={aim.skip}
            onChoose={aim.choose}
          />
          <FirstCafeNudge cafe={cafe} />
          <FirstCafeChecklist cafe={cafe} />
        </div>
      ) : null}
    </div>
  )
}
