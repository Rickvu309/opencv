import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

const sideClass = {
  left: "inset-y-0 left-0 h-full w-64 border-r duration-200 data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
  right:
    "inset-y-0 right-0 h-full w-80 border-l duration-200 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
  bottom:
    "inset-x-0 bottom-0 h-[70vh] border-t duration-200 data-[state=closed]:translate-y-full data-[state=open]:translate-y-0",
  top: "inset-x-0 top-0 h-[70vh] border-b duration-200 data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0",
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
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-40 bg-background shadow-sm transition-transform ease-out",
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
