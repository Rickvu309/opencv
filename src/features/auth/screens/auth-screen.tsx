import { useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/features/auth/screens/auth-form";
import { signInFn, signUpFn, signedInHomeFn } from "@/features/auth/server";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode={mode}
      onSuccess={async () => {
        try {
          await navigate(await signedInHomeFn());
        } catch {
          await navigate({ to: "/proof" });
        }
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
