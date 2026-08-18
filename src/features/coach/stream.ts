import type { AppOpenResult, ApprovalView, ToolCallView } from "@/features/coach/model";
import { appOpenResultSchema, approvalSchema, toolCallSchema } from "@/features/coach/model";

export type CoachStreamEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool-call"; call: ToolCallView }
  | { type: "tool-result"; call: ToolCallView }
  | { type: "open"; result: AppOpenResult }
  | { type: "approval"; approval: ApprovalView }
  | { type: "error"; message: string }
  | { type: "done" };

function parseEvent(raw: string): CoachStreamEvent | null {
  const line = raw.trim();
  if (!line.startsWith("data:")) return null;
  try {
    const payload = JSON.parse(line.slice(5).trim()) as CoachStreamEvent;
    if (payload.type === "text" && typeof payload.text === "string") return payload;
    if (payload.type === "reasoning" && typeof payload.text === "string") return payload;
    if (payload.type === "tool-call") {
      const parsed = toolCallSchema.safeParse(payload.call);
      if (parsed.success) return { type: "tool-call", call: parsed.data };
      return null;
    }
    if (payload.type === "tool-result") {
      const parsed = toolCallSchema.safeParse(payload.call);
      if (parsed.success) return { type: "tool-result", call: parsed.data };
      return null;
    }
    if (payload.type === "approval") {
      const parsed = approvalSchema.safeParse(payload.approval);
      if (parsed.success) return { type: "approval", approval: parsed.data };
      return null;
    }
    if (payload.type === "error" && typeof payload.message === "string") return payload;
    if (payload.type === "open") {
      const rawResult = payload.result as unknown;
      const inner =
        rawResult &&
        typeof rawResult === "object" &&
        "result" in rawResult &&
        "command" in rawResult
          ? (rawResult as { result: unknown }).result
          : rawResult;
      const parsed = appOpenResultSchema.safeParse(inner);
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
    onReasoning?: (accumulated: string) => void;
    onTool?: (call: ToolCallView) => void;
    onOpen: (result: AppOpenResult) => void;
    onApproval?: (approval: ApprovalView) => void;
    onError?: (message: string) => void;
  },
) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let reasoning = "";

  const handle = (event: CoachStreamEvent | null) => {
    if (!event) return;
    if (event.type === "text") {
      accumulated += event.text;
      handlers.onText(accumulated);
    } else if (event.type === "reasoning") {
      reasoning += event.text;
      handlers.onReasoning?.(reasoning);
    } else if (event.type === "tool-call" || event.type === "tool-result") {
      handlers.onTool?.(event.call);
    } else if (event.type === "open") {
      handlers.onOpen(event.result);
    } else if (event.type === "approval") {
      handlers.onApproval?.(event.approval);
    } else if (event.type === "error") {
      handlers.onError?.(event.message);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) handle(parseEvent(chunk));
  }
  if (buffer.trim()) handle(parseEvent(buffer));
}

export async function sendCoachTurn(opts: {
  conversationId: string;
  text: string;
  screen: string;
  grants?: string[];
  signal?: AbortSignal;
  onText: (accumulated: string) => void;
  onReasoning?: (accumulated: string) => void;
  onTool?: (call: ToolCallView) => void;
  onOpen: (result: AppOpenResult) => void;
  onApproval?: (approval: ApprovalView) => void;
  onError?: (message: string) => void;
}) {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId: opts.conversationId,
      text: opts.text,
      screen: opts.screen,
      grants: opts.grants ?? [],
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const message = await res.text();
    opts.onText(message);
    return { ok: false as const, message };
  }
  await readCoachStream(res, {
    onText: opts.onText,
    onReasoning: opts.onReasoning,
    onTool: opts.onTool,
    onOpen: opts.onOpen,
    onApproval: opts.onApproval,
    onError: opts.onError,
  });
  return { ok: true as const };
}
