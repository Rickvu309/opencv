export const RECEIPT_ENTER_STAGGER_MS = 50
export const UNDO_FLASH_MS = 800

export function CoachWorking() {
  return (
    <div role="status" aria-label="Coach is working" className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Working…</p>
      <div
        className="coach-working-bar"
        data-slot="coach-working-bar"
        aria-hidden
      />
    </div>
  )
}
