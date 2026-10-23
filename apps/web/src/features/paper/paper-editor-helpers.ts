export function countWords(text: string | undefined) {
  return (text ?? "").trim().split(/\s+/).filter(Boolean).length
}
