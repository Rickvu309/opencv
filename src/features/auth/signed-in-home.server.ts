import { executeCommand } from "@/core/commands/bus";
import { withClient } from "@/core/db/client.server";
import { afterSignInHome, type AfterSignInDestination } from "@/features/auth/signed-in-home";

export async function loadAfterSignInHome(userId: string): Promise<AfterSignInDestination> {
  const { rows } = await withClient((c) =>
    c.query<{ id: string }>(`select id from proofs where user_id=$1`, [userId]),
  );
  return afterSignInHome({
    proofs: rows,
    createDump: async () => {
      const created = await executeCommand<{ id: string }>(
        "proof.create",
        { title: "" },
        { kind: "user", userId },
      );
      return created.result.id;
    },
  });
}
