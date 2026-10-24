export function Chunks({ parts }: { parts: readonly string[] }) {
  return parts.map((markup, index) => (
    <g key={index} dangerouslySetInnerHTML={{ __html: markup }} />
  ))
}
