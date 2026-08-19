import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicFooter } from "@/features/share/components/public-footer";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <Outlet />
      <PublicFooter />
    </div>
  );
}
