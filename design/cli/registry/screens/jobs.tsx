import { Bell, ArrowRight } from "lucide-react"
import { PageHeader } from "~components/shell"
import { Button } from "~components/button"
import { useToast } from "~components/feedback"
import { AppFrame, RouterLink } from "~app/app-frame"

/** Coming soon: one promise, one action, a peek at what is coming. */
export default function Jobs() {
  const toast = useToast()
  return (
    <AppFrame>
      <PageHeader title="Jobs" />
      <div className="flex flex-1 flex-col items-center overflow-hidden pt-24">
        <div className="flex w-[560px] max-w-full flex-col items-center gap-3 px-6 text-center">
          <span className="text-small inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium ring-1 ring-border ring-inset">
            <span className="bg-fg-3 size-1.5 rounded-full" />
            Coming soon
          </span>
          <h1 className="text-[32px] font-semibold tracking-[-0.9px]">
            Jobs, matched to you
          </h1>
          <p className="text-fg-2 max-w-[460px] text-[14px] leading-[1.55]">
            Openings across Vietnam, ranked by how well you fit. We're building
            it now.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              icon={<Bell className="size-3.5" />}
              onClick={() =>
                toast({ tone: "success", message: "You're on the list" })
              }
            >
              Notify me
            </Button>
            <RouterLink
              href="/apply"
              className="rounded-btn text-fg-2 hover:bg-subtle inline-flex h-8 items-center gap-1.5 px-3"
            >
              Track a job in Apply
              <ArrowRight className="size-3.5" />
            </RouterLink>
          </div>
        </div>
        <div className="rounded-t-panel bg-canvas relative mt-12 w-[760px] max-w-[90%] flex-1 overflow-hidden ring-[0.5px] ring-border">
          {[
            "Marketing Executive",
            "Content Specialist",
            "Growth Associate",
            "Brand Assistant",
          ].map((r, i) => (
            <div
              key={r}
              className="flex items-center gap-3 border-b-[0.5px] border-border px-5 py-3.5"
            >
              <span className="rounded-row bg-chip size-7" />
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{r}</span>
                <span className="text-small text-fg-3">Ho Chi Minh City</span>
              </span>
              <span className="text-small text-fg-3">{92 - i * 7}% fit</span>
            </div>
          ))}
          <div className="from-surface absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />
        </div>
      </div>
    </AppFrame>
  )
}
