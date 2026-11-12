import { useReducer } from "react"
import { useQuery } from "@tanstack/react-query"
import type { QueryOutput } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { SearchInput } from "@workspace/ui/components/search-input"
import { cn } from "@workspace/ui/lib/utils"

import {
  SettingsLoadError,
  SettingsSection,
  SettingsSkeletons,
  SETTINGS_ROW_BUTTON,
  SettingsTitle,
} from "./settings-layout.tsx"
import { connectGmail, GMAIL_UNAVAILABLE } from "./settings-api.ts"
import { fetchIntegrations, integrationsKey } from "@/lib/account-api.ts"

import { ConnectionList } from "@/features/connections/index.ts"

type IntegrationsState = { search: string; notice?: string }

type IntegrationsAction =
  | { type: "search_typed"; value: string }
  | { type: "connect_started" }
  | { type: "connect_unavailable"; notice: string }

function integrationsReducer(
  state: IntegrationsState,
  action: IntegrationsAction
): IntegrationsState {
  switch (action.type) {
    case "search_typed":
      return { ...state, search: action.value }
    case "connect_started":
      return { ...state, notice: undefined }
    case "connect_unavailable":
      return { ...state, notice: action.notice }
  }
}

export function IntegrationsSection() {
  const catalog = useQuery({
    queryKey: integrationsKey(),
    queryFn: fetchIntegrations,
  })
  const [{ search, notice }, dispatch] = useReducer(integrationsReducer, {
    search: "",
  })

  if (catalog.isPending) {
    return (
      <>
        <SettingsTitle title="Integrations">
          Connect the apps you already use.
        </SettingsTitle>
        <SettingsSkeletons />
      </>
    )
  }
  if (catalog.isError || !catalog.data) {
    return <SettingsLoadError onRetry={() => void catalog.refetch()} />
  }

  const query = search.trim().toLowerCase()
  const groups = catalog.data.groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          query.length === 0 ||
          item.name.toLowerCase().includes(query) ||
          item.line.toLowerCase().includes(query)
      ),
    }))
    .filter((group) => group.items.length > 0)

  async function onConnect() {
    dispatch({ type: "connect_started" })
    const result = await connectGmail()
    if (result.url) {
      window.location.assign(result.url)
      return
    }
    dispatch({ type: "connect_unavailable", notice: GMAIL_UNAVAILABLE })
  }

  return (
    <>
      <SettingsTitle title="Integrations">
        Connect the apps you already use.
      </SettingsTitle>
      <SearchInput
        aria-label="Search integrations"
        placeholder="Search integrations"
        value={search}
        onValueChange={(value) => dispatch({ type: "search_typed", value })}
      />
      <div className="mt-8 flex flex-col">
        {groups.length === 0 ? (
          <div className="mb-7 flex flex-col gap-1">
            <h2 className="text-base font-medium">No integrations match</h2>
            <p className="text-sm text-muted-foreground">Try another word.</p>
          </div>
        ) : (
          groups.map((group) => (
            <SettingsSection
              key={group.id}
              id={group.id}
              label={group.label}
              spacing="grid"
            >
              <div
                data-slot="integration-grid"
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {group.items.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    notice={item.id === "gmail" ? notice : undefined}
                    onConnect={item.id === "gmail" ? onConnect : undefined}
                  />
                ))}
              </div>
            </SettingsSection>
          ))
        )}
        <div data-slot="settings-agent-connections">
          <ConnectionList />
        </div>
      </div>
    </>
  )
}

function IntegrationCard({
  item,
  notice,
  onConnect,
}: {
  item: QueryOutput<"integrations.list">["groups"][number]["items"][number]
  notice?: string
  onConnect?: () => void
}) {
  const showConnect = item.id === "gmail" && item.status === "disabled"
  return (
    <div
      data-slot="integration-card"
      data-integration={item.id}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <IntegrationLogo item={item} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            data-slot="integration-name"
            className="truncate text-[13px] font-medium"
          >
            {item.name}
          </span>
          {item.status === "unavailable" ? (
            item.line ? (
              <span className="truncate text-xs text-muted-foreground">
                {item.line}
              </span>
            ) : null
          ) : (
            <span className="flex items-center gap-[5px] text-xs text-muted-foreground">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  item.status === "enabled"
                    ? "bg-chart-2"
                    : "bg-muted-foreground"
                )}
              />
              {item.status === "enabled" ? "Enabled" : "Disabled"}
            </span>
          )}
        </span>
      </div>
      {showConnect && onConnect ? (
        <Button
          className={SETTINGS_ROW_BUTTON}
          type="button"
          variant="outline"
          onClick={onConnect}
        >
          Connect Gmail
        </Button>
      ) : null}
      {notice ? (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      ) : null}
    </div>
  )
}

const INTEGRATION_LOGOS: Record<string, string> = {
  gmail: "/brands/gmail.svg",
}

function IntegrationLogo({
  item,
}: {
  item: QueryOutput<"integrations.list">["groups"][number]["items"][number]
}) {
  const logo = INTEGRATION_LOGOS[item.id]
  return (
    <span
      aria-hidden
      data-slot="integration-logo"
      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-border bg-card text-[13px] font-semibold text-muted-foreground"
    >
      {logo ? (
        <img alt="" src={logo} className="size-5" />
      ) : (
        item.name.charAt(0)
      )}
    </span>
  )
}
