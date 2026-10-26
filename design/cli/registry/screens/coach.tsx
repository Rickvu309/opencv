import { useEffect, useState } from "react"
import {
  ChevronDown,
  History,
  RefreshCw,
  FileText,
  Briefcase,
  MessagesSquare,
  Mail,
  CalendarCheck,
} from "lucide-react"
import { IconButton } from "~components/button"
import {
  Composer,
  CoachMessage,
  ResultCard,
  Suggestions,
  UserMessage,
  type CoachModel,
} from "~components/coach"
import type { Step } from "~components/feedback"
import { AppFrame } from "~app/app-frame"

const SUGGESTIONS = [
  { label: "More ideas", icon: <RefreshCw /> },
  { label: "Review my CV", icon: <FileText /> },
  { label: "Find roles", icon: <Briefcase /> },
  { label: "Prep an interview", icon: <MessagesSquare /> },
  { label: "Write a cover letter", icon: <Mail /> },
  { label: "Plan my week", icon: <CalendarCheck /> },
]

const WORK: Step[][] = [
  [
    {
      label: "Read Junior Marketing CV",
      meta: "2 roles, 6 bullets",
      state: "active",
    },
    { label: "Read the job post", state: "pending" },
    { label: "Draft bullet rewrites", state: "pending" },
  ],
  [
    {
      label: "Read Junior Marketing CV",
      meta: "2 roles, 6 bullets",
      state: "done",
    },
    {
      label: "Read the job post",
      meta: "Junior Marketing, HCMC",
      state: "active",
    },
    { label: "Draft bullet rewrites", state: "pending" },
  ],
  [
    {
      label: "Read Junior Marketing CV",
      meta: "2 roles, 6 bullets",
      state: "done",
    },
    {
      label: "Read the job post",
      meta: "Junior Marketing, HCMC",
      state: "done",
    },
    { label: "Draft bullet rewrites", meta: "3 of 6", state: "active" },
  ],
]

/** Coach: home with starter prompts, then a thread that shows Coach working. */
export default function Coach() {
  const [model, setModel] = useState<CoachModel>("free")
  const [asked, setAsked] = useState<string | null>(null)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!asked || phase > 2) return
    const h = setTimeout(() => setPhase((p) => p + 1), 1100)
    return () => clearTimeout(h)
  }, [asked, phase])
  const ask = (q: string) => {
    setAsked(q)
    setPhase(0)
  }
  const working = !!asked && phase <= 2

  return (
    <AppFrame>
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b-[0.5px] border-border pr-3 pl-5">
        <button className="inline-flex items-center gap-1 font-medium">
          {asked ? "Tailor CV for Lumière" : "New chat"}
          <ChevronDown className="text-fg-3 size-3" />
        </button>
        <span className="flex-1" />
        <IconButton label="Chat history">
          <History />
        </IconButton>
      </header>
      {!asked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-24">
          <h1 className="text-page mb-2 font-semibold tracking-[-0.5px]">
            How can I help?
          </h1>
          <Composer model={model} onModel={setModel} onSend={ask} />
          <Suggestions
            items={SUGGESTIONS}
            onPick={(s) =>
              ask(
                s === "Review my CV"
                  ? "Tailor my CV for the Lumière posting"
                  : s
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-1 justify-center overflow-y-auto px-6 pt-6">
            <div className="flex w-[720px] max-w-full flex-col gap-5">
              <span className="text-small text-fg-3 text-center">
                Today 9:41
              </span>
              <UserMessage>{asked}</UserMessage>
              {working ? (
                <CoachMessage
                  worked={`Working, ${3 + phase * 3}s`}
                  steps={WORK[Math.min(phase, 2)]}
                />
              ) : (
                <CoachMessage
                  worked="Worked for 12s"
                  followUps={[
                    "Write a cover letter too",
                    "Prep me for the interview",
                  ]}
                  onFollowUp={ask}
                >
                  <p>
                    Done. I rewrote 3 bullets to match what Lumière asks for:
                    campaign results, short-form video and weekly reporting. It
                    still fits on one page.
                  </p>
                  <div className="mt-3">
                    <ResultCard title="Junior Marketing CV" meta="3 changes" />
                  </div>
                </CoachMessage>
              )}
            </div>
          </div>
          <div className="flex justify-center px-6 pt-2 pb-4">
            <Composer
              model={model}
              onModel={setModel}
              onSend={ask}
              working={working}
              context="Junior Marketing CV"
            />
          </div>
        </>
      )}
    </AppFrame>
  )
}
