import { SettingsTitle } from "./settings-layout.tsx"

import { ConnectionList } from "@/features/connections/index.ts"

export function IntegrationsSection() {
  return (
    <>
      <SettingsTitle title="Integrations">
        Connect your own AI agent to OpenCV.
      </SettingsTitle>
      <div data-slot="settings-agent-connections" className="flex flex-col">
        <ConnectionList />
      </div>
    </>
  )
}
