import { useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/features/auth/screens/auth-form";
import { signInFn, signUpFn, signedInHomeFn } from "@/features/auth/server";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const navigate = useNavigate();
  return (
    <AuthForm
      mode={mode}
      onSuccess={async () => {
        const dest = await signedInHomeFn();
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
