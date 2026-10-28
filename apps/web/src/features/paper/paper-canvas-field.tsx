import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"

export function BlockField({
  label,
  value,
  multiline,
  placeholder = label,
  className,
  onChange,
}: {
  label: string
  value: string
  multiline?: boolean
  placeholder?: string
  className?: string
  onChange: (value: string) => void
}) {
  if (multiline) {
    return (
      <Textarea
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`paper-canvas-field min-h-8 resize-y border-0 bg-transparent px-1 py-0 text-sm leading-6 shadow-none focus-visible:ring-0 ${className ?? ""}`}
      />
    )
  }
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`paper-canvas-field h-7 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 ${className ?? ""}`}
    />
  )
}
