import { streamText, tool, stepCountIs, type ModelMessage } from "ai";
import { executeCommand } from "@/core/commands/bus";
import { agentCommands } from "@/core/commands/define";
import { provider, roleModels, writeTrace, aiAvailable } from "@/core/ai/gateway";
import { checkInput } from "@/core/ai/guardrails";
import { loadProfile } from "@/features/profile/load.server";
import { withClient } from "@/core/db/client.server";
import { newId } from "@/core/ids";
import "@/features/register";
import persona from "./persona.md?raw";

async function insertMessage(
  conversationId: string,
  role: "user" | "assistant" | "tool",
  content: unknown,
) {
  await withClient((c) =>
    c.query(
      `insert into messages (id, conversation_id, role, content) values ($1,$2,$3,$4::jsonb)`,
      [newId(), conversationId, role, JSON.stringify(content)],
    ),
  );
  await withClient((c) =>
    c.query(`update conversations set last_message_at = now() where id = $1`, [conversationId]),
  );
}

export async function coachTurn(opts: {
  userId: string;
  conversationId: string;
  text: string;
  screen?: string;
  grants?: string[];
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
  await insertMessage(opts.conversationId, "user", [{ type: "text", text: opts.text }]);
  const history = (
    await withClient((c) =>
      c.query<{ role: string; content: { text?: string }[] }>(
        `select role, content from messages where conversation_id=$1 order by created_at`,
        [opts.conversationId],
      ),
    )
  ).rows;
  const actor = { kind: "coach" as const, userId: opts.userId, conversationId: opts.conversationId };
  const granted = new Set(opts.grants ?? []);
  const tools = Object.fromEntries(
    agentCommands().map((cmd) => [
      cmd.name.replaceAll(".", "_"),
      tool({
        description: `${cmd.description} Command: ${cmd.name}`,
        inputSchema: cmd.input,
        execute: async (input) => {
          if (cmd.destructive && !granted.has(cmd.name)) {
            return {
              ok: false,
              pendingApproval: true,
              command: cmd.name,
              input,
              description: cmd.description,
            };
          }
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
  const collected: { type: string; text?: string; name?: string; input?: unknown; output?: unknown }[] =
    [];
  const result = streamText({
    model: p.chatModel(roleModels.chat),
    system: `${persona}\n\nCurrent screen: ${opts.screen ?? "/coach"}\nProfile snapshot: ${JSON.stringify(profile)}`,
    messages,
    tools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, usage }) => {
      const parts = [
        ...collected,
        { type: "text", text },
      ];
      await insertMessage(opts.conversationId, "assistant", parts);
      await writeTrace({
        userId: opts.userId,
        kind: "turn",
        role: "chat",
        duration: Date.now() - started,
        tokens: { in: usage?.inputTokens ?? 0, out: usage?.outputTokens ?? 0 },
      });
    },
  });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            send({ type: "text", text: part.text });
          } else if (part.type === "reasoning-delta") {
            send({ type: "reasoning", text: part.text });
            collected.push({ type: "reasoning", text: part.text });
          } else if (part.type === "tool-call") {
            const call = {
              id: part.toolCallId,
              name: String(part.toolName).replaceAll("_", "."),
              input: part.input,
              status: "pending" as const,
            };
            collected.push({ type: "tool", name: call.name, input: call.input });
            send({ type: "tool-call", call });
          } else if (part.type === "tool-result") {
            const output = part.output as {
              ok?: boolean;
              pendingApproval?: boolean;
              command?: string;
              input?: unknown;
              description?: string;
              result?: unknown;
            };
            const name = String(part.toolName).replaceAll("_", ".");
            if (output?.pendingApproval) {
              send({
                type: "approval",
                approval: {
                  command: output.command ?? name,
                  input: output.input,
                  description: output.description ?? name,
                },
              });
              send({
                type: "tool-result",
                call: {
                  id: part.toolCallId,
                  name,
                  input: output.input,
                  status: "failed",
                  output: { pending: true },
                },
              });
            } else {
              send({
                type: "tool-result",
                call: {
                  id: part.toolCallId,
                  name,
                  status: output?.ok === false ? "failed" : "completed",
                  output: output?.result ?? output,
                },
              });
              if (name === "app.open") {
                send({ type: "open", result: output?.result ?? output });
              }
            }
          } else if (part.type === "tool-error") {
            send({
              type: "tool-result",
              call: {
                id: part.toolCallId,
                name: String(part.toolName).replaceAll("_", "."),
                status: "failed",
                output: { error: String(part.error) },
              },
            });
          } else if (part.type === "error") {
            send({ type: "error", message: "The Coach didn't reply. Try again." });
          }
        }
        send({ type: "done" });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
