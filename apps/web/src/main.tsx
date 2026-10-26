import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import "@workspace/ui/globals.css"
import "@/styles/paper.css"
import "@/styles/coach.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { createQueryClient } from "@/lib/query-client.ts"
import { createAppRouter } from "@/router.tsx"

// eslint-disable-next-line react-refresh/only-export-components -- Sonner stays in its own chunk
const Toaster = lazy(() =>
  import("@workspace/ui/components/sonner").then((mod) => ({
    default: mod.Toaster,
  }))
)

const queryClient = createQueryClient()
const router = createAppRouter()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
