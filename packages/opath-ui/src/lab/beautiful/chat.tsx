import { Clock, MoreHorizontal, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../cn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../tabs";
import "./beautiful.css";
import { PromptBar } from "./prompt-bar";

export interface ChatReply {
  tools: string[];
  elapsed: string;
  body: string;
}

export interface ChatThread {
  id: string;
  label: string;
  prompt: string;
  replies: ChatReply[];
}

export interface ChatProps {
  threads?: ChatThread[];
}

const DEFAULT_THREADS: ChatThread[] = [
  {
    id: "topics",
    label: "Topics",
    prompt: "Compare the north batch to last summer",
    replies: [
      {
        tools: ["Sales history", "Line data"],
        elapsed: "4s",
        body: "Pulled 3 summers of north-batch sales for comparison.",
      },
      {
        tools: ["Comparison", "Trend detection"],
        elapsed: "2s",
        body: "The north batch is up 12% with stronger weekend peaks.",
      },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    prompt: "Who can restock by Friday",
    replies: [
      {
        tools: ["Vendor index"],
        elapsed: "3s",
        body: "Three vendors can ship by Friday. Two already have the SKU on hand.",
      },
    ],
  },
];

export function Chat({ threads = DEFAULT_THREADS }: ChatProps) {
  const [tab, setTab] = useState(threads[0]?.id ?? "topics");

  return (
    <div className="flex h-[18rem] w-full max-w-[24rem] flex-col overflow-hidden rounded-[var(--radius-container)] border border-hairline bg-surface-1">
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-hairline p-1.5">
          <TabsList className="gap-0">
            {threads.map((thread) => (
              <TabsTrigger
                key={thread.id}
                value={thread.id}
                className="min-h-0 rounded-[var(--radius-control)] px-2 py-[3px] text-[13px] data-[state=active]:bg-surface-2 data-[state=active]:text-ink"
              >
                {thread.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-1">
            <IconBtn label="New">
              <Plus className="size-3.5" />
            </IconBtn>
            <IconBtn label="History">
              <Clock className="size-3.5" />
            </IconBtn>
            <IconBtn label="More">
              <MoreHorizontal className="size-3.5" />
            </IconBtn>
          </div>
        </div>
        {threads.map((thread) => (
          <TabsContent key={thread.id} value={thread.id} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pt-2.5 pb-1">
              <div className="flex justify-end pl-14">
                <div className="rounded-[var(--radius-container)] bg-surface-2 px-3 py-1.5 text-[13px] leading-[1.4] text-ink">
                  {thread.prompt}
                </div>
              </div>
              {thread.replies.map((reply) => (
                <div key={reply.body} className="flex w-full flex-col gap-1.5">
                  <div className="flex items-center gap-1 text-[12px] leading-[1.3]">
                    <span className="font-[510] text-ink">{reply.tools[0]}</span>
                    {reply.tools[1] ? (
                      <span className="text-ink-secondary">{reply.tools[1]}</span>
                    ) : null}
                    <span className="text-ink">for {reply.elapsed}</span>
                  </div>
                  <p className="text-[13px] leading-normal text-ink">{reply.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-auto shrink-0 p-1.5">
              <PromptBar
                placeholder="Prompt or tag a record with @"
                shape="vanilla"
                showAttach={false}
                showSwitcher={false}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function IconBtn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-[var(--radius-control)] text-ink-faint",
        "transition-colors duration-[var(--duration-fast)] hover:bg-surface-2 hover:text-ink-secondary",
      )}
    >
      {children}
    </button>
  );
}
