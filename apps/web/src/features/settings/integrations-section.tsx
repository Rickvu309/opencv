import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { QueryOutput } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { SearchInput } from "@workspace/ui/components/search-input"

import {
  SettingsLoadError,
  SettingsSection,
  SettingsSkeletons,
  SettingsTitle,
  StateWord,
} from "./settings-layout.tsx"
import { connectGmail, GMAIL_UNAVAILABLE } from "./settings-api.ts"
import { fetchIntegrations, integrationsKey } from "@/lib/account-api.ts"

export function IntegrationsSection() {
  const catalog = useQuery({
    queryKey: integrationsKey(),
    queryFn: fetchIntegrations,
  })
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<string>()

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
    setNotice(undefined)
    const result = await connectGmail()
    if (result.url) {
      window.location.assign(result.url)
      return
    }
    setNotice(GMAIL_UNAVAILABLE)
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
        onValueChange={setSearch}
      />
      {groups.length === 0 ? (
        <div className="mt-6 flex flex-col gap-1">
          <h2 className="text-base font-medium">No integrations match</h2>
          <p className="text-sm text-muted-foreground">Try another word.</p>
        </div>
      ) : (
        groups.map((group) => (
          <SettingsSection key={group.id} label={group.label}>
            <div className="flex flex-col gap-2">
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
      className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{item.name}</span>
          {item.line ? (
            <span className="text-sm text-muted-foreground">{item.line}</span>
          ) : null}
        </span>
        {item.status === "unavailable" ? null : (
          <StateWord on={item.status === "enabled"} />
        )}
      </div>
      {showConnect && onConnect ? (
        <Button type="button" variant="glow" onClick={onConnect}>
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
