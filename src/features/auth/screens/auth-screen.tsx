import { useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/features/auth/screens/auth-form";
import { signInFn, signUpFn } from "@/features/auth/server";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode={mode}
      onSuccess={() => navigate({ to: "/coach" })}
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
