import { createFileRoute } from "@tanstack/react-router";
import { AuthScreen } from "@/features/auth/screens/auth-screen";

export const Route = createFileRoute("/sign-in")({
  component: () => <AuthScreen mode="sign-in" />,
});
