"use client";

import Link from "next/link";
import {
  CircleHelp,
  GraduationCap,
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

/**
 * The ? button, bottom left like Linear's — but lean: redo onboarding,
 * ask the coach how to use it, send feedback, and one shortcut worth knowing.
 */
export function HelpButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="fixed bottom-2.5 left-4 z-30">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Trợ giúp"
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
            <Link href="/onboarding">
              <GraduationCap />
              Làm lại onboarding
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/coach?q=${encodeURIComponent("OpenPath dùng thế nào? Chỉ mình những gì nên làm trước.")}`}
            >
              <MessageCircleQuestion />
              Hỏi coach cách dùng OpenPath
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="mailto:hello@openpath.vn">
              <Send />
              Gửi góp ý
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={toggleSidebar}>
            <PanelLeft />
            Đóng/mở thanh bên
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            OpenPath · bản prototype
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
