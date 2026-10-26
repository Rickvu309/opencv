import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react"
import { Search as SearchIcon, X } from "lucide-react"
import { cn } from "./cn"

/** Label above, helper below. An error replaces the helper and says how to fix it. */
export function Field({
  label,
  helper,
  error,
  children,
  className,
}: {
  label: string
  helper?: string
  error?: string
  children: (id: string, describedBy?: string) => ReactNode
  className?: string
}) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small text-fg-2 font-medium">
        {label}
      </label>
      {children(id, helper || error ? msgId : undefined)}
      {error ? (
        <p id={msgId} className="text-small text-danger">
          {error}
        </p>
      ) : helper ? (
        <p id={msgId} className="text-small text-fg-3">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "rounded-btn bg-surface text-body text-fg hover:ring-border-strong focus:ring-focus disabled:bg-subtle disabled:text-fg-3 h-8 w-full px-2.5 ring-1 ring-border transition-shadow outline-none ring-inset focus:ring-[1.5px]",
        invalid && "ring-danger hover:ring-danger focus:ring-danger",
        className
      )}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "rounded-tile bg-surface text-body text-fg focus:ring-focus w-full resize-y px-3 py-2.5 leading-normal ring-1 ring-border outline-none ring-inset focus:ring-[1.5px]",
        className
      )}
      {...rest}
    />
  )
})

/** Filters the list below it as you type. Clear button once filled. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-tile bg-surface focus-within:ring-focus flex h-9 items-center gap-2 px-3 ring-1 ring-border ring-inset focus-within:ring-[1.5px]",
        className
      )}
    >
      <SearchIcon className="text-fg-3 size-[15px] shrink-0" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="text-body h-full min-w-0 flex-1 bg-transparent outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-fg-3 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
