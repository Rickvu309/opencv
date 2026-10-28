import type { ReactNode } from "react"
import { Download, Lock, Mail } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const SPARK_PATH =
  "M3 48l14.8-0.9 14.8 0 14.8-1.8 14.8-2.7 14.8-1.7 14.8-5.4 14.8-2.7 14.8-1.8 14.8-5.3 14.8-2.7 14.8-3.6 14.8-3.6 14.8-3.5 14.8-3.6 14.8-2.7"

const NEWSLETTER_BARS = [18, 22, 26, 24, 32, 38, 44, 52]
const VIEW_BARS = [10, 16, 12, 22, 18, 28, 34]

const TOAST =
  "flex w-fit items-center gap-2.5 rounded-full border border-border bg-card py-3 pr-[18px] pl-3 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_32px_rgb(0_0_0/0.08)]"

function Bars({
  heights,
  className,
  barClassName,
}: {
  heights: number[]
  className: string
  barClassName: string
}) {
  return (
    <div className={cn("flex items-end", className)}>
      {heights.map((height, index) => (
        <span
          key={index}
          style={{ height }}
          className={cn(
            "flex-1",
            barClassName,
            index === heights.length - 1 ? "bg-foreground" : null
          )}
        />
      ))}
    </div>
  )
}

function ProfileButton({
  icon,
  label,
  primary = false,
}: {
  icon: ReactNode
  label: string
  primary?: boolean
}) {
  return (
    <span
      className={cn(
        "flex h-[30px] items-center gap-1.5 rounded-lg pr-3 pl-2.5 text-[12.5px]",
        primary
          ? "bg-foreground font-medium text-background"
          : "border border-border text-foreground/90"
      )}
    >
      {icon}
      {label}
    </span>
  )
}

export function PitchHeroArt() {
  return (
    <div
      aria-hidden="true"
      className="relative flex flex-col gap-6 xl:absolute xl:top-[180px] xl:left-[430px] xl:block xl:h-[420px] xl:w-[1000px]"
    >
      <div className="flex w-full flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_3px_rgb(0_0_0/0.06),0_30px_70px_rgb(0_0_0/0.1)] xl:absolute xl:top-0 xl:left-[170px] xl:w-[780px]">
        <div className="flex h-[38px] items-center gap-1.5 border-b border-border bg-background px-3.5">
          <span className="size-[9px] rounded-full bg-border" />
          <span className="size-[9px] rounded-full bg-border" />
          <span className="size-[9px] rounded-full bg-border" />
          <span className="flex min-w-0 flex-1 justify-center">
            <span className="flex h-[22px] items-center gap-[5px] rounded-md border border-border bg-card px-2.5 text-[11.5px] text-muted-foreground">
              <Lock className="size-2.5 text-muted-foreground/80" />
              opencv.me/u/linh-nguyen
            </span>
          </span>
          <span className="w-[39px] shrink-0" />
        </div>
        <div className="flex flex-col px-5 pt-6 pb-6 xl:px-11 xl:pt-[30px] xl:pb-9">
          <div className="flex items-center gap-4">
            <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-border to-muted-foreground/40 text-[20px] font-semibold text-foreground/85">
              LN
            </span>
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[30px] font-semibold tracking-[-1px] text-foreground">
                Linh Nguyen
              </span>
              <span className="text-[13px] text-muted-foreground/85">
                Marketing, Ho Chi Minh City
              </span>
            </span>
          </div>
          <p className="mt-[18px] max-w-[540px] text-[15px] leading-normal text-foreground/90">
            I listen to buyers, then write content that sells.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ProfileButton
              primary
              icon={<Download className="size-[13px]" />}
              label="Download CV"
            />
            <ProfileButton
              icon={<Mail className="size-[13px] text-foreground/80" />}
              label="Email"
            />
            <ProfileButton
              icon={<LinkedinIcon className="size-[13px] text-foreground/80" />}
              label="LinkedIn"
            />
          </div>
          <p className="mt-6 text-[10.5px] font-semibold tracking-[0.8px] text-muted-foreground/85">
            PROOF OF WORK
          </p>
          <div className="mt-2.5 flex gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex h-24 items-center justify-center rounded-[10px] border border-border/50 bg-muted/60">
                <svg
                  viewBox="0 0 230 52"
                  fill="none"
                  className="h-auto w-[230px] max-w-full text-foreground"
                >
                  <path
                    d={SPARK_PATH}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="225" cy="6" r="4" fill="currentColor" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-foreground">
                Followers +38%
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex h-24 items-center justify-center rounded-[10px] border border-border/50 bg-muted/60">
                <Bars
                  heights={NEWSLETTER_BARS}
                  className="h-[52px] w-[200px] max-w-full gap-1.5"
                  barClassName="rounded-[3px] bg-muted-foreground/20"
                />
              </div>
              <span className="text-[13px] font-semibold text-foreground">
                52% open rate
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 xl:contents">
        <div className={cn(TOAST, "xl:absolute xl:top-[404px] xl:left-24")}>
          <span className="flex size-[34px] items-center justify-center rounded-full bg-muted text-[11.5px] font-semibold text-foreground/85">
            HT
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-foreground">
              Hanh Tran opened your Pitch
            </span>
            <span className="text-[12px] text-muted-foreground/85">
              Just now
            </span>
          </span>
        </div>
        <div
          className={cn(TOAST, "xl:absolute xl:top-[-44px] xl:left-[118px]")}
        >
          <span className="flex size-[34px] items-center justify-center rounded-full bg-foreground text-background">
            <Download className="size-[15px]" />
          </span>
          <span className="text-[13px] font-semibold text-foreground">
            3 CV downloads
          </span>
        </div>
        <div className="flex w-[200px] flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_12px_32px_rgb(0_0_0/0.08)] xl:absolute xl:top-[372px] xl:left-[520px]">
          <div className="flex items-end gap-2">
            <span className="text-[28px] font-semibold tracking-[-1px] text-foreground">
              24
            </span>
            <span className="text-[12px] leading-[2.2] text-muted-foreground/85">
              views
            </span>
          </div>
          <Bars
            heights={VIEW_BARS}
            className="h-[34px] gap-[5px]"
            barClassName="rounded-[2px] bg-border"
          />
        </div>
      </div>
    </div>
  )
}

// lucide-react 1.x dropped its brand icons. This is lucide's linkedin, which the pen names.
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}
