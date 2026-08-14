"use client";

import { CommandPalette, useCommandPalette } from "@/components/command-palette";

/** Keyboard-only ⌘K. There is no Search button in the rail header. */
export function CommandPaletteHost() {
  const palette = useCommandPalette();
  return <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />;
}
