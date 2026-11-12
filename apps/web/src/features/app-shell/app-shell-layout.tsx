import { useReducer, type ReactNode } from "react"
import { useShortcut } from "@/lib/use-shortcut.ts"
import { useNavigate } from "@tanstack/react-router"

import { AppShell } from "@/features/app-shell/app-shell.tsx"
import { SURFACE_PATHS, type SurfaceId } from "@/lib/product-paths.ts"
import { ShellOverlays } from "@/features/auth/shell-overlays.tsx"
import { CommandPalette } from "@/features/command-palette/command-palette.tsx"
import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"

export function AppShellLayout({ sidebar }: { sidebar?: ReactNode }) {
  return (
    <ChatStoreProvider>
      <ShellOverlays>
        <AppShellChrome sidebar={sidebar} />
      </ShellOverlays>
    </ChatStoreProvider>
  )
}

type SearchAction =
  | { type: "shortcut_pressed" }
  | { type: "search_requested" }
  | { type: "palette_closed" }

function searchReducer(open: boolean, action: SearchAction) {
  if (action.type === "shortcut_pressed") return !open
  return action.type === "search_requested"
}

function AppShellChrome({ sidebar }: { sidebar?: ReactNode }) {
  const navigate = useNavigate()
  const [searchOpen, dispatchSearch] = useReducer(searchReducer, false)

  useShortcut({
    key: "k",
    mod: true,
    inFields: true,
    onPress: () => dispatchSearch({ type: "shortcut_pressed" }),
  })

  function goSurface(id: SurfaceId) {
    void navigate({ to: SURFACE_PATHS[id] })
  }

  return (
    <>
      <AppShell
        sidebar={sidebar}
        onSearch={() => dispatchSearch({ type: "search_requested" })}
      />
      <CommandPalette
        open={searchOpen}
        onOpenChange={(open) =>
          dispatchSearch({ type: open ? "search_requested" : "palette_closed" })
        }
        onSurface={goSurface}
      />
    </>
  )
}
