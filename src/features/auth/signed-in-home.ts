export type AfterAuthHome = "onboarding" | "dump" | "list";

export type SignedInDestination =
  | { to: "/onboarding" }
  | { to: "/proof" }
  | { to: "/proof/$proofId"; params: { proofId: string } };

export function afterAuthHome(input: {
  onboardingCompleted: boolean;
  proofIds: readonly string[];
}): AfterAuthHome {
  if (!input.onboardingCompleted) return "onboarding";
  return input.proofIds.length === 0 ? "dump" : "list";
}

export async function resolveSignedInHome(input: {
  onboardingCompleted: boolean;
  proofIds: readonly string[];
  createDump: () => Promise<string>;
}): Promise<SignedInDestination> {
  const home = afterAuthHome(input);
  if (home === "onboarding") return { to: "/onboarding" };
  if (home === "list") return { to: "/proof" };
  const proofId = await input.createDump();
  return { to: "/proof/$proofId", params: { proofId } };
}
