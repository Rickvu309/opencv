import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { AppsCatalog } from "@/features/app-shell/apps-catalog.tsx"
import { getDevProfile } from "@/features/app-shell/dev-profile.ts"
import { useMediaQuery } from "@/features/app-shell/use-media-query.ts"
import {
  SETTINGS_TAB_ITEMS,
  SURFACE_COPY,
  isSettingsTab,
  type SettingsTab,
} from "@/features/app-shell/surfaces.ts"

type SettingsWorkspaceProps = {
  tab?: SettingsTab
  onTabChange?: (tab: SettingsTab) => void
}

export function SettingsWorkspace({
  tab = "general",
  onTabChange,
}: SettingsWorkspaceProps) {
  const copy = SURFACE_COPY.settings
  const profile = getDevProfile()
  const isDesktop = useMediaQuery("(min-width: 768px)", true)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border bg-background px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isSettingsTab(value)) onTabChange?.(value)
        }}
        orientation={isDesktop ? "vertical" : "horizontal"}
        className="min-h-0 flex-1 gap-0 max-md:flex-col"
      >
        <TabsList
          variant="line"
          aria-label="Settings sections"
          className="h-auto w-full flex-row flex-wrap justify-start rounded-none border-b border-border bg-background px-3 py-2 md:w-48 md:flex-col md:items-stretch md:border-r md:border-b-0 md:p-3"
        >
          {SETTINGS_TAB_ITEMS.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="justify-start px-3 py-2 font-normal data-active:bg-muted data-active:font-medium"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0 flex-1 overflow-auto p-6">
          <TabsContent value="general">
            <section className="max-w-lg space-y-4">
              <h2 className="text-sm font-semibold">General</h2>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-medium">Language</p>
                <p className="mt-1 text-xs text-muted-foreground">English</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-medium">Time zone</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Asia/Ho Chi Minh (UTC+7)
                </p>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="apps">
            <section>
              <h2 className="mb-4 text-sm font-semibold">Connected apps</h2>
              <AppsCatalog />
            </section>
          </TabsContent>

          <TabsContent value="account">
            <section className="max-w-lg space-y-4">
              <h2 className="text-sm font-semibold">Account</h2>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-medium">{profile.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {profile.email}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-medium">Sign out</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Coming soon
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled
                >
                  Sign out
                </Button>
              </div>
            </section>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
