import { executeCommand } from "@/core/commands/bus";
import { withClient } from "@/core/db/client.server";
import { resolveSignedInHome, type SignedInDestination } from "@/features/auth/signed-in-home";

export async function loadSignedInHome(
  userId: string,
  onboardingCompleted: boolean,
): Promise<SignedInDestination> {
  const { rows } = await withClient((c) =>
    c.query<{ id: string }>(`select id from proofs where user_id=$1 order by updated_at desc`, [
      userId,
    ]),
  );
  return resolveSignedInHome({
    onboardingCompleted,
    proofIds: rows.map((row) => row.id),
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
