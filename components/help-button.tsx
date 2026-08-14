"use client";

import {
  Check,
  CircleHelp,
  Languages,
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
import { useDispatch } from "@/lib/actions/store";
import { localeNames, locales } from "@/lib/i18n/locale";
import { useSidebar } from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/use-t";

/**
 * The ? button, bottom left like Linear's: the first four steps, send
 * feedback, switch language, and one shortcut worth knowing.
 *
 * Language lives here rather than in the account menu so it is one tap from
 * every screen, including when the rail is closed.
 */
export function HelpButton() {
  const { toggleSidebar } = useSidebar();
  const dispatch = useDispatch();
  const { t, m, locale } = useT();

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
          {/* Each language names itself in its own language: offering
              "Vietnamese" to someone who only reads Vietnamese is a menu
              they cannot use. */}
          <DropdownMenuLabel className="flex items-center gap-2 font-normal text-muted-foreground">
            <Languages className="size-3.5" />
            {t(m.common.language)}
          </DropdownMenuLabel>
          {locales.map((code) => (
            <DropdownMenuItem
              key={code}
              onSelect={() =>
                dispatch("settings.setLanguage", { language: code }, { silent: true })
              }
            >
              <span className="flex-1">{localeNames[code]}</span>
              {locale === code && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
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
