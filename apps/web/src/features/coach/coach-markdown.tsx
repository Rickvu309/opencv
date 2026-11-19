import { Response } from "@/components/ai-elements/response.tsx"

export function CoachMarkdown({
  text,
  writing = false,
}: {
  text: string
  writing?: boolean
}) {
  return <Response text={text} writing={writing} />
}
