import { NATIVE_WRITER } from "@workspace/domain"

export function paperCommandInput(name: string, input: unknown) {
  if (
    (name === "paper.rename" ||
      name === "paper.duplicate" ||
      name === "paper.setStatus") &&
    input !== null &&
    typeof input === "object" &&
    !("writer" in input)
  )
    return { ...input, writer: NATIVE_WRITER }
  return input
}
