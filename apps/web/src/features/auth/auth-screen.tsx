import type { ReactNode } from "react"

import { OpenPathLogo } from "@/features/app-shell/app-logo.tsx"

type AuthScreenProps = {
  title: string
  body: string
  children: ReactNode
}

export function AuthScreen({ title, body, children }: AuthScreenProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-8">
        <OpenPathLogo withWordmark size="md" />
        <header className="space-y-2">
          <h1 className="font-[ui-serif,Georgia,Cambria,serif] text-3xl font-normal tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{body}</p>
        </header>
        {children}
      </div>
    </div>
  )
}
