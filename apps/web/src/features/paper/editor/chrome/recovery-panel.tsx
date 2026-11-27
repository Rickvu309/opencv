import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { CopyButton } from "@workspace/ui/components/copy-button"
import { CopyIcon } from "lucide-react"

export function RecoveryPanel({
  texts,
  onDismiss,
}: {
  texts: readonly string[]
  onDismiss: (index: number) => void
}) {
  if (!texts.length) return null
  return (
    <section
      aria-label="Text from your offline session"
      className="paper-recovery"
      data-paper-recovery=""
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle>Text from your offline session</CardTitle>
          <CardDescription>
            This text could not find its place in the Paper. Copy it and put it
            back where you want it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {texts.map((text, index) => (
            <div
              key={`${index}:${text}`}
              className="flex items-start gap-2 rounded-md border border-border p-2"
            >
              <p
                className="min-w-0 flex-1 text-sm whitespace-pre-wrap"
                data-recovered-text=""
              >
                {text}
              </p>
              <CopyButton
                aria-label="Copy this text"
                value={text}
                className="size-11 md:size-7"
              >
                <CopyIcon />
              </CopyButton>
              <Button
                variant="ghost"
                size="touch"
                onClick={() => onDismiss(index)}
              >
                Dismiss
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
