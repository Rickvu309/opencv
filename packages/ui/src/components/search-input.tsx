import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "cn"

import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"

type SearchInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value: string
  onValueChange: (value: string) => void
  clearLabel?: string
}

function SearchInput({
  value,
  onValueChange,
  clearLabel = "Clear search",
  disabled,
  readOnly,
  ...inputProps
}: SearchInputProps) {
  const canClear = !disabled && !readOnly

  function clearSearch(event: React.MouseEvent<HTMLButtonElement>) {
    if (!canClear) return
    const input = event.currentTarget
      .closest('[data-slot="search-input"]')
      ?.querySelector("input")
    onValueChange("")
    input?.focus()
  }

  return (
    <InputGroup
      data-slot="search-input"
      className="h-9 gap-2 rounded-md border-border bg-card px-3"
    >
      <Search
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <InputGroupInput
        {...inputProps}
        type="search"
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        className={cn(
          "h-auto min-w-0 gap-0 border-0 px-0 py-0 text-base text-foreground shadow-none ring-0 placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0 md:text-sm [&::-webkit-search-cancel-button]:appearance-none",
          inputProps.className
        )}
      />
      {value.length > 0 ? (
        <InputGroupButton
          aria-label={clearLabel}
          size="icon-xs"
          disabled={!canClear}
          onClick={clearSearch}
          className="shrink-0"
        >
          <X aria-hidden="true" className="size-4" />
        </InputGroupButton>
      ) : null}
    </InputGroup>
  )
}

export { SearchInput }
