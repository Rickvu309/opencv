"use client";

import {
  CircleHelp,
  PanelLeft,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivationChecklist } from "@/components/onboarding/activation-checklist";
import { useSidebar } from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/use-t";

/**
 * The ? button, bottom left like Linear's: the first four steps, send
 * feedback, and one shortcut worth knowing.
 */
export function HelpButton() {
  const { toggleSidebar } = useSidebar();
  const { t, m } = useT();

  // In flow inside the layout's mobile control row; floats into the frame's
  // bottom gutter from md.
  return (
    <div className="z-30 shrink-0 md:fixed md:bottom-2.5 md:left-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t(m.help.label)}
            className="rounded-lg text-muted-foreground md:bg-transparent"
          >
            <CircleHelp />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-72"
        >
          <ActivationChecklist />
          <DropdownMenuItem asChild>
            <a href="mailto:hello@openpath.vn">
              <Send />
              {t(m.help.sendFeedback)}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={toggleSidebar}>
            <PanelLeft />
            {t(m.common.toggleSidebar)}
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t(m.help.prototypeNote)}
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
