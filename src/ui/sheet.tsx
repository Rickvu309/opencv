import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

const sideClass = {
  left: "inset-y-0 left-0 h-full w-[var(--size-rail)] border-r border-hairline duration-[var(--duration-base)] ease-[var(--ease-drawer)] data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
  right:
    "inset-y-0 right-0 h-full w-80 border-l border-hairline duration-[var(--duration-base)] ease-[var(--ease-drawer)] data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
  bottom:
    "inset-x-0 bottom-0 h-[70vh] border-t border-hairline duration-[var(--duration-base)] ease-[var(--ease-drawer)] data-[state=closed]:translate-y-full data-[state=open]:translate-y-0",
  top: "inset-x-0 top-0 h-[70vh] border-b border-hairline duration-[var(--duration-base)] ease-[var(--ease-drawer)] data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0",
} as const;

export function SheetContent({
  className,
  side = "left",
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof sideClass;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="overlay-enter fixed inset-0 z-[var(--z-overlay)] bg-scrim" />
      <DialogPrimitive.Content
        className={cn(
          "sheet-motion fixed z-[var(--z-overlay)] bg-surface-1 shadow-[var(--shadow-overlay)] transition-transform",
          sideClass[side],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
