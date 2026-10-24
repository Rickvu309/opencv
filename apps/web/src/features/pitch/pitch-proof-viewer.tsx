import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { ProofDocument } from "@workspace/domain"

import { PROOF_STEP_LABEL } from "@/features/paper/paper-proof-types.ts"

export function PitchProofViewer({
  proof,
  onClose,
}: {
  proof: ProofDocument | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={proof !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {proof ? (
          <>
            <DialogHeader>
              <DialogTitle>{proof.title}</DialogTitle>
              <DialogDescription>
                {proof.subtitle ?? "Proof chain"}
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3">
              {proof.steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-xl border border-border bg-muted/20 p-3"
                >
                  <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                    {PROOF_STEP_LABEL[step.type]}
                  </p>
                  {step.title && step.title !== PROOF_STEP_LABEL[step.type] ? (
                    <p className="mt-1 text-sm font-medium">{step.title}</p>
                  ) : null}
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                  {step.photos.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {step.photos.map((photo) => (
                        <li key={photo.id}>
                          <img
                            src={photo.url}
                            alt={photo.caption ?? ""}
                            className="h-16 w-24 rounded-lg object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
