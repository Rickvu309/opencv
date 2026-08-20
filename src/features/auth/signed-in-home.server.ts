import { executeCommand } from "@/core/commands/bus";
import { withClient } from "@/core/db/client.server";
import { resolveSignedInHome, type SignedInDestination } from "@/features/auth/signed-in-home";

export async function loadSignedInHome(
  userId: string,
  onboardingCompleted: boolean,
  opts?: { mint?: boolean },
): Promise<SignedInDestination> {
  const { rows } = await withClient((c) =>
    c.query<{ id: string; has_log: boolean }>(
      `select p.id,
              exists(
                select 1 from proof_entries e
                where e.proof_id = p.id and e.body <> ''
              ) as has_log
         from proofs p
        where p.user_id = $1
        order by p.updated_at desc`,
      [userId],
    ),
  );
  return resolveSignedInHome({
    onboardingCompleted,
    proofs: rows.map((row) => ({ id: row.id, hasLog: row.has_log })),
    createDump:
      opts?.mint === false
        ? undefined
        : async () => {
            const created = await executeCommand<{ id: string }>(
              "proof.create",
              { title: "" },
              { kind: "user", userId },
            );
            return created.result.id;
          },
  });
}
