import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getConversationFn,
  listConversationsFn,
} from "@/features/coach/queries";
import { runCommand } from "@/ui/run-command";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";
import { checklistFn } from "@/features/onboarding/queries";

export function CoachScreen() {
  const convos = useQuery({ queryKey: ["convos"], queryFn: () => listConversationsFn() });
  const checklist = useQuery({ queryKey: ["checklist"], queryFn: () => checklistFn() });
  const [active, setActive] = useState<string | null>(null);
  const thread = useQuery({
    queryKey: ["thread", active],
    queryFn: () => getConversationFn({ data: { id: active! } }),
    enabled: Boolean(active),
  });
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const offline = convos.data?.offline ?? false;

  async function ensureConversation() {
    if (active) return active;
    const created = await runCommand<{ id: string }>("conversation.start", {
      title: text.slice(0, 40) || "New conversation",
    });
    setActive(created.result.id);
    convos.refetch();
    return created.result.id;
  }

  async function send(message: string) {
    const id = await ensureConversation();
    setReply("");
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: id, text: message, screen: "/coach" }),
    });
    if (!res.ok) {
      setReply(await res.text());
      return;
    }
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value);
        setReply(acc);
      }
    }
    thread.refetch();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside>
        <Button
          variant="outline"
          onClick={() => void runCommand("conversation.start", { title: "New conversation" }).then(() => convos.refetch())}
        >
          New
        </Button>
        <ul className="mt-4 space-y-2">
          {convos.data?.conversations.map((c: { id: string; title: string }) => (
            <li key={c.id}>
              <button className="text-left text-[14px]" onClick={() => setActive(c.id)}>
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <h1 className="text-[28px] font-medium">Coach</h1>
        {offline ? (
          <p className="mt-2 text-muted-foreground">
            The Coach is offline right now. Everything else in the app still works.
          </p>
        ) : null}
        {checklist.data && !checklist.data.dismissed ? (
          <ul className="mt-4 text-[14px] text-muted-foreground">
            {checklist.data.items.map((i: { id: string; label: string; done: boolean }) => (
              <li key={i.id}>
                {i.done ? "✓" : "○"} {i.label}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 min-h-48 space-y-3">
          {thread.data?.messages.map((m: { id: string; role: string; content: { text?: string }[] }) => (
            <p key={m.id}>
              <span className="text-[14px] text-muted-foreground">{m.role}: </span>
              {Array.isArray(m.content) ? m.content.map((c) => c.text).join(" ") : ""}
            </p>
          ))}
          {reply ? <p>{reply}</p> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Where do I start?", "Look at my CV", "What fits my background?"].map((s) => (
            <Button key={s} variant="ghost" onClick={() => void send(s)}>
              {s}
            </Button>
          ))}
        </div>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
            setText("");
          }}
        >
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <Textarea id="composer" value={text} onChange={(e) => setText(e.target.value)} />
          <Button className="mt-2" type="submit" disabled={offline}>
            Send
          </Button>
        </form>
      </section>
    </div>
  );
}
