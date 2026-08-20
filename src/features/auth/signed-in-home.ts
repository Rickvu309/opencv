export type AfterSignInProof = { id: string; hasLog?: boolean };

export type AfterSignInDestination =
  | { to: "/paper" }
  | { to: "/proof/$proofId"; params: { proofId: string } };

export function proofListShowsEndOfList(proofs: readonly AfterSignInProof[]) {
  return proofs.some((proof) => proof.hasLog);
}

export async function openDump(input: {
  proofs: readonly AfterSignInProof[];
  createDump: () => Promise<string>;
}): Promise<Extract<AfterSignInDestination, { to: "/proof/$proofId" }>> {
  const empty = input.proofs.find((proof) => !proof.hasLog);
  if (empty) return { to: "/proof/$proofId", params: { proofId: empty.id } };
  const proofId = await input.createDump();
  return { to: "/proof/$proofId", params: { proofId } };
}

export async function afterSignInHome(input: {
  proofs: readonly AfterSignInProof[];
  createDump: () => Promise<string>;
}): Promise<AfterSignInDestination> {
  if (proofListShowsEndOfList(input.proofs)) return { to: "/paper" };
  return openDump(input);
}
