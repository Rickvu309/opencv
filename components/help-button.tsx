"use client";

import Link from "next/link";
import {
  CircleHelp,
  MessageCircleQuestion,
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
import { useSidebar } from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/use-t";

/**
 * The ? button, bottom left like Linear's, but lean: ask the coach how to
 * use it, send feedback, and one shortcut worth knowing.
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
            className="rounded-full border bg-card text-muted-foreground shadow-xs md:border-transparent md:bg-transparent md:shadow-none"
          >
            <CircleHelp />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-64"
        >
          <DropdownMenuItem asChild>
            <Link href="/help">
              <CircleHelp />
              {t(m.nav.support)}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/coach?q=${encodeURIComponent(t(m.help.askHowToUsePrompt))}`}
            >
              <MessageCircleQuestion />
              {t(m.help.askHowToUse)}
            </Link>
          </DropdownMenuItem>
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
