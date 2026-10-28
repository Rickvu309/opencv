import { useState } from "react"
import { ArrowUp, Briefcase, ChevronDown, Plus } from "lucide-react"

import type { ActivityFeedRow, JobDetail, JobId } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { useRunCommand } from "@/lib/contract-client.ts"

import {
  ActivityItem,
  ChecklistItemRow,
  InitialsAvatar,
  TITLE_TEXT,
} from "./apply-detail-parts.tsx"
import { companyInitials, monthDay } from "./apply-stages.ts"
import { FAINT_TEXT } from "./apply-tone.ts"

const NOTE_PLACEHOLDER = "placeholder:text-muted-foreground/84"

const POSTING = [
  ["What you'll do", "duties"],
  ["What they look for", "requirements"],
  ["Details", "details"],
] as const

const BULLET_PREFIX = /^\s*(?:[-*•]\s+)/

function lines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter(Boolean)
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-[13.5px] leading-[16px] font-semibold text-foreground">
      {children}
    </h2>
  )
}

function Paragraph({ children }: { children: string }) {
  return (
    <p
      className={cn(
        "text-[14px] leading-[1.65] whitespace-pre-wrap",
        TITLE_TEXT
      )}
    >
      {children}
    </p>
  )
}

function Bullets({ text }: { text: string }) {
  return (
    <ul className="flex flex-col">
      {lines(text).map((line, index) => (
        <li key={`${index}-${line}`} className="flex gap-2.5 pb-1">
          <span className={cn("text-[14px] leading-[1.65]", FAINT_TEXT.card)}>
            •
          </span>
          <span className={cn("flex-1 text-[14px] leading-[1.65]", TITLE_TEXT)}>
            {line}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Posting({ job }: { job: JobDetail }) {
  const about = job.posting?.about ?? job.description
  return (
    <div className="flex flex-col gap-5">
      {about ? (
        <section className="flex flex-col gap-2">
          <SectionHeading>About the role</SectionHeading>
          <Paragraph>{about}</Paragraph>
        </section>
      ) : null}
      {job.posting
        ? POSTING.map(([heading, key]) => (
            <section key={key} className="flex flex-col gap-2">
              <SectionHeading>{heading}</SectionHeading>
              <Bullets text={job.posting?.[key] ?? ""} />
            </section>
          ))
        : null}
    </div>
  )
}

function InterviewPrep({ job }: { job: JobDetail }) {
  const run = useRunCommand()
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [step, setStep] = useState("")
  const done = job.checklist.filter((item) => item.done).length
  const total = job.checklist.length
  const name =
    total > 0 ? `Interview prep, ${done} of ${total}` : "Interview prep"

  return (
    <section aria-label={name} className="flex flex-col">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="h-4 flex-1 justify-start gap-2 px-0 text-[13px] font-medium text-muted-foreground hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-muted-foreground"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "size-[13px] transition-transform duration-(--duration-micro) ease-(--ease-micro)",
              !open && "-rotate-90"
            )}
          />
          <span>Interview prep</span>
          {total > 0 ? (
            <span
              className={cn(
                "text-[12.5px] leading-[15px] font-normal",
                FAINT_TEXT.card
              )}
            >
              {done}/{total}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Add a step"
          className="-my-1 text-muted-foreground"
          onClick={() => {
            setOpen(true)
            setAdding(true)
          }}
        >
          <Plus aria-hidden className="size-3.5" />
        </Button>
      </div>
      {open ? (
        <div className="mt-1.5 flex flex-col">
          {job.checklist.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onToggle={() =>
                void run("job.setChecklistItem", {
                  jobId: job.id,
                  itemId: item.id,
                  done: !item.done,
                })
              }
            />
          ))}
          {adding ? (
            <form
              className="flex h-[34px] items-center gap-2.5 px-2"
              onSubmit={(event) => {
                event.preventDefault()
                const label = step.trim()
                if (!label) return
                void run("job.addChecklistItem", {
                  jobId: job.id,
                  label,
                }).then(() => {
                  setStep("")
                })
              }}
            >
              <span
                aria-hidden
                className="size-[15px] shrink-0 rounded-full ring-[1.2px] ring-input ring-inset"
              />
              <Input
                aria-label="Add a step"
                autoFocus
                value={step}
                placeholder="Add a step"
                className="h-7 border-0 bg-transparent px-0 text-[13.5px] shadow-none focus-visible:ring-0 md:text-[13.5px] dark:bg-transparent"
                onChange={(event) => setStep(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setStep("")
                    setAdding(false)
                  }
                }}
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function Comment({ row, author }: { row: ActivityFeedRow; author: string }) {
  return (
    <li
      data-slot="comment"
      className="my-2.5 flex flex-col gap-1.5 rounded-[10px] border border-border px-3.5 py-3"
    >
      <div className="flex items-center gap-2">
        <InitialsAvatar
          initials={companyInitials(author)}
          size={20}
          fontSize={8}
        />
        <span className="text-[12.5px] font-medium text-foreground">
          {author}
        </span>
        <time
          dateTime={row.createdAt}
          className={cn("text-[12.5px]", FAINT_TEXT.card)}
        >
          {monthDay(new Date(row.createdAt))}
        </time>
      </div>
      <p
        className={cn(
          "text-[13.5px] leading-[1.55] whitespace-pre-wrap",
          TITLE_TEXT
        )}
      >
        {row.summary}
      </p>
    </li>
  )
}

function NoteComposer({ jobId }: { jobId: JobId }) {
  const run = useRunCommand()
  const [note, setNote] = useState("")

  function submit() {
    const body = note.trim()
    if (!body) return
    void run("job.addNote", { jobId, body }).then(() => {
      setNote("")
    })
  }

  return (
    <form
      className="flex min-h-11 items-center gap-2 rounded-[10px] border border-border py-1.5 pr-2 pl-3.5 focus-within:ring-3 focus-within:ring-ring/50"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Textarea
        aria-label="Leave a note"
        value={note}
        rows={1}
        placeholder="Leave a note…"
        className={cn(
          "min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0 md:text-[13px] dark:bg-transparent",
          NOTE_PLACEHOLDER
        )}
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <Button
        type="submit"
        variant="ghost"
        aria-label="Leave a note"
        className="size-7 shrink-0 rounded-full p-0 hover:bg-transparent"
      >
        <ArrowUp
          aria-hidden
          className="size-7 rounded-full bg-secondary p-[7px] text-muted-foreground"
        />
      </Button>
    </form>
  )
}

export function JobDocument({
  job,
  rows,
  author,
}: {
  job: JobDetail
  rows: ActivityFeedRow[]
  author: string
}) {
  const ordered = [...rows].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
  const hasPrep = job.checklist.length > 0 || job.stage !== "closed"
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col">
      <h1 className="text-2xl leading-[29px] font-semibold tracking-[-0.5px] text-foreground">
        {job.title}
      </h1>
      <div className="mt-1.5 flex items-center gap-2">
        <Briefcase
          aria-hidden
          className="size-[22px] shrink-0 rounded-[6px] border border-foreground/8 bg-card p-1 text-foreground"
        />
        <span className="text-[14.5px] text-muted-foreground">
          {job.company}
        </span>
      </div>
      <div className="mt-[22px]">
        <Posting job={job} />
      </div>
      {hasPrep ? (
        <div className="mt-[22px]">
          <InterviewPrep job={job} />
        </div>
      ) : null}
      <section
        aria-label="Activity"
        className={cn("flex flex-col", hasPrep ? "mt-[30px]" : "mt-[58px]")}
      >
        <h2 className="text-[14px] leading-[17px] font-semibold text-foreground">
          Activity
        </h2>
        <ul className="mt-3 flex flex-col gap-0">
          {ordered.map((row) =>
            row.command === "job.addNote" ? (
              <Comment key={row.id} row={row} author={author} />
            ) : (
              <ActivityItem key={row.id} row={row} />
            )
          )}
        </ul>
        <div className="mt-3">
          <NoteComposer jobId={job.id} />
        </div>
      </section>
    </div>
  )
}
