import { createFileRoute, redirect } from "@tanstack/react-router";
import { signedInHomeFn } from "@/features/auth/server";
import { ProofListScreen } from "@/features/proof/screens/list";

export const Route = createFileRoute("/_app/proof/")({
  beforeLoad: async () => {
    const dest = await signedInHomeFn();
    if (dest.to === "/proof/$proofId") throw redirect(dest);
  },
  component: ProofListScreen,
});
