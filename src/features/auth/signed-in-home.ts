export type AfterSignInProof = { id: string; hasLog?: boolean };

export type AfterSignInDestination =
  | { to: "/proof" }
  | { to: "/proof/$proofId"; params: { proofId: string } };

export async function afterSignInHome(input: {
  proofs: readonly AfterSignInProof[];
  createDump: () => Promise<string>;
}): Promise<AfterSignInDestination> {
  if (input.proofs.some((proof) => proof.hasLog)) return { to: "/proof" };
  const empty = input.proofs.find((proof) => !proof.hasLog);
  if (empty) return { to: "/proof/$proofId", params: { proofId: empty.id } };
  const proofId = await input.createDump();
  return { to: "/proof/$proofId", params: { proofId } };
}
