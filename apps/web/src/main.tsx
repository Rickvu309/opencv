import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import "@workspace/ui/globals.css"
import "@/styles/paper.css"
import "@/styles/coach.css"
import { createQueryClient } from "@/lib/query-client.ts"
import { placeToastsAsTheyShow } from "@/lib/toast-clearance.ts"
import { createAppRouter } from "@/router.tsx"

// eslint-disable-next-line react-refresh/only-export-components -- Sonner stays in its own chunk
const Toaster = lazy(() =>
  import("@workspace/ui/components/sonner").then((mod) => ({
    default: mod.Toaster,
  }))
)

const queryClient = createQueryClient()
const router = createAppRouter({ queryClient })

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <div
        data-slot="toast-host"
        className="contents"
        ref={placeToastsAsTheyShow}
      >
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </div>
    </QueryClientProvider>
  </StrictMode>
)
