import { CraftStub } from "@/features/app-shell/craft-stub.tsx"

/**
 * Spec 4 replaces this module with the real Paper workspace.
 * Do not import shell chrome — the route mounts this into `<Outlet />`.
 */
export function PaperWorkspace() {
  return <CraftStub surface="paper" />
}
