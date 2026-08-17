import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { streamText, tool, type ModelMessage } from "ai";
import { executeCommand } from "@/core/commands/bus";
import { agentCommands } from "@/core/commands/define";
import { provider, roleModels, writeTrace, aiAvailable } from "@/core/ai/gateway";
import { checkInput } from "@/core/ai/guardrails";
import { loadProfile } from "@/features/profile/load.server";
import { withClient } from "@/core/db/client.server";
import { newId } from "@/core/ids";
import "@/features/register";

const persona = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "persona.md"),
  "utf8",
);

export async function coachTurn(opts: {
  userId: string;
  conversationId: string;
  text: string;
  screen?: string;
}) {
  const blocked = checkInput(opts.text);
  if (blocked) {
    return new Response(blocked, { headers: { "content-type": "text/plain" } });
  }
  if (!aiAvailable()) {
    return new Response("The Coach is offline right now. Everything else in the app still works.", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
  const profile = await loadProfile(opts.userId);
  await withClient((c) =>
    c.query(
      `insert into messages (id, conversation_id, role, content) values ($1,$2,'user',$3::jsonb)`,
      [newId(), opts.conversationId, JSON.stringify([{ type: "text", text: opts.text }])],
    ),
  );
  const history = (
    await withClient((c) =>
      c.query<{ role: string; content: { text?: string }[] }>(
        `select role, content from messages where conversation_id=$1 order by created_at`,
        [opts.conversationId],
      ),
    )
  ).rows;
  const actor = { kind: "coach" as const, userId: opts.userId, conversationId: opts.conversationId };
  const tools = Object.fromEntries(
    agentCommands().map((cmd) => [
      cmd.name.replaceAll(".", "_"),
      tool({
        description: `${cmd.description} Command: ${cmd.name}`,
        inputSchema: cmd.input,
        execute: async (input) => {
          const result = await executeCommand(cmd.name, input, actor);
          return { ok: true, command: cmd.name, logId: result.id, result: result.result };
        },
      }),
    ]),
  );
  const p = provider();
  if (!p) {
    return new Response("The Coach is offline right now.", { status: 503 });
  }
  const started = Date.now();
  const messages: ModelMessage[] = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: Array.isArray(m.content) ? m.content.map((c) => c.text ?? "").join("\n") : String(m.content),
  }));
  const result = streamText({
    model: p.chatModel(roleModels.chat),
    system: `${persona}\n\nCurrent screen: ${opts.screen ?? "/coach"}\nProfile snapshot: ${JSON.stringify(profile)}`,
    messages,
    tools,
    onFinish: async ({ text, usage }) => {
      await withClient((c) =>
        c.query(
          `insert into messages (id, conversation_id, role, content) values ($1,$2,'assistant',$3::jsonb)`,
          [newId(), opts.conversationId, JSON.stringify([{ type: "text", text }])],
        ),
      );
      await writeTrace({
        userId: opts.userId,
        kind: "turn",
        role: "chat",
        duration: Date.now() - started,
        tokens: { in: usage?.inputTokens ?? 0, out: usage?.outputTokens ?? 0 },
      });
    },
  });
  return result.toTextStreamResponse();
}
