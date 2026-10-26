import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { SettingsTitle } from "./settings-layout.tsx"
import { UPGRADE_PLACEHOLDER } from "./settings-api.ts"

export function UpgradeScreen() {
  const navigate = useNavigate()
  return (
    <>
      <SettingsTitle title="Upgrade to Pro">
        {UPGRADE_PLACEHOLDER}
      </SettingsTitle>
      <Button
        type="button"
        variant="glow"
        onClick={() => void navigate({ href: "/app/settings/billing" })}
      >
        Back to billing
      </Button>
    </>
  )
}
