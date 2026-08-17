import { env } from "@/core/config/env";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { newId } from "@/core/ids";
import { withClient } from "@/core/db/client.server";

export const modelRoles = [
  "chat",
  "drafting",
  "extraction",
  "scoring",
  "cheap",
] as const;
export type ModelRole = (typeof modelRoles)[number];

const roleModels: Record<ModelRole, string> = {
  chat: "openai/gpt-4.1-mini",
  drafting: "openai/gpt-4.1-mini",
  extraction: "openai/gpt-4.1-mini",
  scoring: "openai/gpt-4.1-mini",
  cheap: "openai/gpt-4.1-nano",
};

export function aiAvailable() {
  return Boolean(env("OPENROUTER_API_KEY"));
}

function provider() {
  const key = env("OPENROUTER_API_KEY");
  if (!key) return null;
  return createOpenAICompatible({
    name: "openrouter",
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

export async function complete(opts: {
  role: ModelRole;
  userId: string;
  system: string;
  prompt: string;
  schema?: z.ZodType;
}) {
  const p = provider();
  if (!p) return { unavailable: true as const, text: "", object: null };
  const started = Date.now();
  const model = p.chatModel(roleModels[opts.role]);
  if (opts.schema) {
    const result = await generateObject({
      model,
      system: opts.system,
      prompt: opts.prompt,
      schema: opts.schema,
    });
    await writeTrace({
      userId: opts.userId,
      kind: "task",
      role: opts.role,
      duration: Date.now() - started,
    });
    return { unavailable: false as const, text: "", object: result.object };
  }
  const result = await generateText({
    model,
    system: opts.system,
    prompt: opts.prompt,
  });
  await writeTrace({
    userId: opts.userId,
    kind: "task",
    role: opts.role,
    duration: Date.now() - started,
    tokens: {
      in: result.usage?.inputTokens ?? 0,
      out: result.usage?.outputTokens ?? 0,
    },
  });
  return { unavailable: false as const, text: result.text, object: null };
}

export async function writeTrace(opts: {
  userId: string;
  kind: string;
  role: string;
  duration: number;
  tokens?: { in: number; out: number };
  tools?: unknown;
}) {
  await withClient((c) =>
    c.query(
      `insert into ai_traces (id, user_id, kind, model_role, input_tokens, output_tokens, duration_ms, tools)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        newId(),
        opts.userId,
        opts.kind,
        opts.role,
        opts.tokens?.in ?? 0,
        opts.tokens?.out ?? 0,
        opts.duration,
        JSON.stringify(opts.tools ?? []),
      ],
    ),
  );
}

export { provider, roleModels };
