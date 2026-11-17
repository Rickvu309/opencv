import * as React from "react"
import type { Popover as BasePopover } from "@base-ui/react/popover"
import { expectTypeOf } from "vitest"
import { Button } from "./components/button"
import { Popover, PopoverContent, PopoverTrigger } from "./components/popover"

type RootProps = React.ComponentProps<typeof Popover>
type ChangeDetails = Parameters<NonNullable<RootProps["onOpenChange"]>>[1]
type ContentProps = React.ComponentProps<typeof PopoverContent>
type ContentRender = Exclude<
  NonNullable<ContentProps["render"]>,
  React.ReactElement
>
type ContentState = Parameters<ContentRender>[1]

expectTypeOf<ChangeDetails["reason"]>().toExtend<string>()
expectTypeOf<ChangeDetails["cancel"]>().toEqualTypeOf<() => void>()
expectTypeOf<ContentState["open"]>().toEqualTypeOf<boolean>()
expectTypeOf<ChangeDetails>().not.toExtend<BasePopover.Root.ChangeEventDetails>()
expectTypeOf<ContentState>().not.toExtend<BasePopover.Popup.State>()

export function FeaturePopoverContract({
  open,
  setOpen,
  discard,
  commit,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  discard: () => void
  commit: () => void
}) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        setOpen(next)
        if (!next) {
          if (details.reason === "escape-key") discard()
          else commit()
        }
      }}
    >
      <PopoverTrigger render={<Button />}>Edit</PopoverTrigger>
      <PopoverContent initialFocus={input} finalFocus={() => false}>
        <input ref={input} aria-label="Location" />
      </PopoverContent>
    </Popover>
  )
}
