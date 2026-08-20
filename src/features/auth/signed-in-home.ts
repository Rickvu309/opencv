export type AfterSignInDestination =
  | { to: "/proof" }
  | { to: "/proof/$proofId"; params: { proofId: string } };

export async function afterSignInHome(input: {
  proofs: readonly { id: string }[];
  createDump: () => Promise<string>;
}): Promise<AfterSignInDestination> {
  if (input.proofs.length === 0) {
    const proofId = await input.createDump();
    return { to: "/proof/$proofId", params: { proofId } };
  }
  return { to: "/proof" };
}
