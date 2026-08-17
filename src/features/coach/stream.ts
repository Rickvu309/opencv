import type { AppOpenResult } from "@/features/coach/model";
import { appOpenResultSchema } from "@/features/coach/model";

export type CoachStreamEvent =
  | { type: "text"; text: string }
  | { type: "open"; result: AppOpenResult }
  | { type: "done" };

function parseEvent(raw: string): CoachStreamEvent | null {
  const line = raw.trim();
  if (!line.startsWith("data:")) return null;
  try {
    const payload = JSON.parse(line.slice(5).trim()) as CoachStreamEvent;
    if (payload.type === "text" && typeof payload.text === "string") return payload;
    if (payload.type === "open") {
      const parsed = appOpenResultSchema.safeParse(payload.result);
      if (parsed.success) return { type: "open", result: parsed.data };
      return null;
    }
    if (payload.type === "done") return payload;
    return null;
  } catch {
    return null;
  }
}

export async function readCoachStream(
  res: Response,
  handlers: {
    onText: (accumulated: string) => void;
    onOpen: (result: AppOpenResult) => void;
  },
) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const event = parseEvent(chunk);
      if (!event) continue;
      if (event.type === "text") {
        accumulated += event.text;
        handlers.onText(accumulated);
      } else if (event.type === "open") {
        handlers.onOpen(event.result);
      }
    }
  }
  if (buffer.trim()) {
    const event = parseEvent(buffer);
    if (event?.type === "text") {
      accumulated += event.text;
      handlers.onText(accumulated);
    } else if (event?.type === "open") {
      handlers.onOpen(event.result);
    }
  }
}

export async function sendCoachTurn(opts: {
  conversationId: string;
  text: string;
  screen: string;
  onText: (accumulated: string) => void;
  onOpen: (result: AppOpenResult) => void;
}) {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId: opts.conversationId,
      text: opts.text,
      screen: opts.screen,
    }),
  });
  if (!res.ok) {
    const message = await res.text();
    opts.onText(message);
    return { ok: false as const, message };
  }
  await readCoachStream(res, { onText: opts.onText, onOpen: opts.onOpen });
  return { ok: true as const };
}
