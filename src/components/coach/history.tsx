"use client";

import * as React from "react";
import { usePathname, useRouter } from "@/lib/nav";
import { Check, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";
import { useCoach } from "./provider";

/** Same density as `components/layout/app-sidebar.tsx`. */
const rowSize = "h-10 text-sm md:h-7 md:text-[13px]";

/**
 * Starts a new chat, without throwing the current one away.
 *
 * It used to route to `/coach?new=1`, which was the only way to reset the one
 * thread that existed. Conversations are kept now, so this asks the thread for
 * a new one and navigates only if you are somewhere else.
 */
export function NewChatButton({
  trigger,
}: {
  trigger: React.ReactElement<{ onClick?: () => void }>;
}) {
  const router = useRouter();
  const thread = useCoach();

  return React.cloneElement(trigger, {
    onClick: () => {
      thread.startNewChat();
      router.push("/coach");
    },
  });
}

/**
 * The conversations this browser knows about.
 *
 * What used to sit in this file was a search field over a day-grouped list, and
 * it was deleted as theatre: there was one thread, and nothing the list showed
 * could be restored by clicking it. Both halves of that are now false, so the
 * list is back — smaller, and real.
 *
 * Named by what the user asked first. Not by the model: naming a thread would
 * cost a turn, this model takes the better part of a minute per turn, and the
 * opening question is both free and what someone scans for.
 */
export function ConversationMenu({
  trigger,
}: {
  trigger: React.ReactElement<{ onClick?: () => void }>;
}) {
  const thread = useCoach();
  const router = useRouter();
  const { t, m } = useT();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem
          onSelect={() => {
            thread.startNewChat();
            router.push("/coach");
          }}
        >
          <Plus />
          {t(m.coach.startNewChat)}
        </DropdownMenuItem>

        {thread.conversations.length > 0 && <DropdownMenuSeparator />}

        {thread.conversations.map((conversation) => {
          const current = conversation.id === thread.conversationId;
          return (
            <DropdownMenuItem
              key={conversation.id}
              onSelect={() => {
                thread.switchTo(conversation.id);
                router.push("/coach");
              }}
              className="group"
            >
              <Check className={cn("shrink-0", !current && "opacity-0")} />
              <span className="min-w-0 flex-1 truncate">
                {conversation.title || t(m.coach.newChat)}
              </span>
              {/* A button inside a menu item: `onSelect` on the row would fire
                  as well and reopen the thread being deleted. */}
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                aria-label={t(m.coach.deleteChat)}
                className="shrink-0 opacity-0 group-focus:opacity-100 group-hover:opacity-100"
              >
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    thread.deleteConversation(conversation.id);
                  }}
                >
                  <Trash2 />
                </span>
              </Button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Stored threads for the rail History section.
 *
 * New chat lives in the header switcher, not in this list. Empty means
 * nothing: no placeholder, no badge. Both call the same `useCoach()` APIs.
 */
export function ConversationRail() {
  const thread = useCoach();
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { t, m } = useT();
  const onCoach = pathname.startsWith("/coach");

  if (thread.conversations.length === 0) return null;

  return (
    <SidebarGroupContent>
      <SidebarMenu>
        {thread.conversations.map((conversation) => {
          const current = onCoach && conversation.id === thread.conversationId;
          return (
            <SidebarMenuItem key={conversation.id}>
              <SidebarMenuButton
                isActive={current}
                className={rowSize}
                onClick={() => {
                  thread.switchTo(conversation.id);
                  router.push("/coach");
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <span>{conversation.title || t(m.coach.newChat)}</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                showOnHover
                className="top-2.5 md:top-1"
                aria-label={t(m.coach.deleteChat)}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  thread.deleteConversation(conversation.id);
                }}
              >
                <Trash2 />
              </SidebarMenuAction>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  );
}
