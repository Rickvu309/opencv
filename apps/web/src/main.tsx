import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import "@workspace/ui/globals.css"
import "@/styles/paper.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { createQueryClient } from "@/lib/query-client.ts"
import { createAppRouter } from "@/router.tsx"

const queryClient = createQueryClient()
const router = createAppRouter()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
