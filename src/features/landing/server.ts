import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";

export const joinWaitlistFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email("enter a valid email") }))
  .handler(async ({ data }) => {
    try {
      const { withClient } = await import("@/core/db/client.server");
      await withClient((c) =>
        c.query(`insert into waitlist (email) values ($1) on conflict do nothing`, [
          data.email.trim().toLowerCase(),
        ]),
      );
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "That did not go through. Try again." };
    }
  });
