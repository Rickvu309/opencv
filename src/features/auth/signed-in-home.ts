export type AfterAuthHome = "onboarding" | "dump" | "list";

export type SignedInProof = { id: string; hasLog: boolean };

export type SignedInDestination =
  | { to: "/onboarding" }
  | { to: "/proof" }
  | { to: "/proof/$proofId"; params: { proofId: string } };

export function afterAuthHome(input: {
  onboardingCompleted: boolean;
  proofs: readonly SignedInProof[];
}): AfterAuthHome {
  if (!input.onboardingCompleted) return "onboarding";
  return input.proofs.some((proof) => proof.hasLog) ? "list" : "dump";
}

export async function resolveSignedInHome(input: {
  onboardingCompleted: boolean;
  proofs: readonly SignedInProof[];
  createDump?: () => Promise<string>;
}): Promise<SignedInDestination> {
  const home = afterAuthHome(input);
  if (home === "onboarding") return { to: "/onboarding" };
  if (home === "list") return { to: "/proof" };
  const existing = input.proofs.find((proof) => !proof.hasLog);
  if (existing) return { to: "/proof/$proofId", params: { proofId: existing.id } };
  if (!input.createDump) return { to: "/proof" };
  const proofId = await input.createDump();
  return { to: "/proof/$proofId", params: { proofId } };
}
