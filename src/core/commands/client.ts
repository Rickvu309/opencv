import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

export const dispatchFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string(),
      inputJson: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { executeCommand } = await import("@/core/commands/bus");
    const { requireUser } = await import("@/core/auth/session");
    await import("@/features/register");
    const user = await requireUser();
    const executed = await executeCommand(
      data.name,
      JSON.parse(data.inputJson) as unknown,
      { kind: "user", userId: user.id },
    );
    return { id: executed.id, resultJson: JSON.stringify(executed.result ?? null) };
  });

export const undoFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ logId: z.string() }))
  .handler(async ({ data }) => {
    const { undoCommand } = await import("@/core/commands/bus");
    const { requireUser } = await import("@/core/auth/session");
    await import("@/features/register");
    const user = await requireUser();
    const executed = await undoCommand(data.logId, { kind: "user", userId: user.id });
    return { id: executed.id, resultJson: JSON.stringify(executed.result ?? null) };
  });
