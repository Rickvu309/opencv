import { useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/features/auth/screens/auth-form";
import { afterSignInHome } from "@/features/auth/signed-in-home";
import { signInFn, signUpFn } from "@/features/auth/server";
import { listProofsFn } from "@/features/proof/queries";
import { runCommand } from "@/ui/run-command";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode={mode}
      onSuccess={async () => {
        const dest = await afterSignInHome({
          proofs: await listProofsFn(),
          createDump: async () => {
            const r = await runCommand<{ id: string }>("proof.create", { title: "" });
            return r.result.id;
          },
        });
        await navigate(dest);
      }}
      onSubmit={async (creds) => {
        const result =
          mode === "sign-up"
            ? await signUpFn({ data: { ...creds, remember: true } })
            : await signInFn({ data: creds });
        return result;
      }}
    />
  );
}
