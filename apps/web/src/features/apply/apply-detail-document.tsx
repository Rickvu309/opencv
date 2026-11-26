import { useId, useReducer } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowUp, Briefcase, Plus } from "lucide-react"

import { type ActivityFeedRow } from "@workspace/domain/account"
import {
  jobAddChecklistItemInputSchema,
  jobAddNoteInputSchema,
  type JobDetail,
} from "@workspace/domain/apply"
import { catalog, type JobId } from "@workspace/domain/kernel"
import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import { reportRejected } from "@/lib/command-failure.ts"
import { catalogClient } from "@/lib/contract-client.ts"

import {
  ActivityItem,
  ChecklistItemRow,
  InitialsAvatar,
  TITLE_TEXT,
} from "./apply-detail-parts.tsx"
import { companyInitials, monthDay } from "./apply-stages.ts"
import { FAINT_TEXT } from "./apply-tone.ts"
import { useChosenTimeZone } from "./apply-time-zone.ts"

const NOTE_PLACEHOLDER = "placeholder:text-muted-foreground/84"

const POSTING = [
  ["What you'll do", "duties"],
  ["What they look for", "requirements"],
  ["Details", "details"],
] as const

const BULLET_PREFIX = /^\s*(?:[-*•]\s+)/
const PREP_STEP_MAX_LENGTH =
  jobAddChecklistItemInputSchema.shape.label.maxLength
const NOTE_MAX_LENGTH = jobAddNoteInputSchema.shape.body.maxLength

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

type PrepState = {
  open: boolean
  adding: boolean
  step: string
  message: string | null
}

type PrepAction =
  | { type: "toggled" }
  | { type: "add_started" }
  | { type: "step_typed"; value: string }
  | { type: "step_added" }
  | { type: "add_cancelled" }
  | { type: "message_set"; message: string }
  | { type: "message_cleared" }

const PREP_START: PrepState = {
  open: true,
  adding: false,
  step: "",
  message: null,
}

function prepReducer(state: PrepState, action: PrepAction): PrepState {
  switch (action.type) {
    case "toggled":
      return { ...state, open: !state.open }
    case "add_started":
      return { ...state, open: true, adding: true, message: null }
    case "step_typed":
      return { ...state, step: action.value, message: null }
    case "step_added":
      return { ...state, step: "", message: null }
    case "add_cancelled":
      return { ...state, step: "", adding: false, message: null }
    case "message_set":
      return { ...state, message: action.message }
    case "message_cleared":
      return { ...state, message: null }
  }
}

function InterviewPrep({ job }: { job: JobDetail }) {
  const queryClient = useQueryClient()
  const [{ open, adding, step, message }, dispatch] = useReducer(
    prepReducer,
    PREP_START
  )
  const messageId = useId()
  const done = job.checklist.filter((item) => item.done).length
  const total = job.checklist.length
  const name =
    total > 0 ? `Interview prep, ${done} of ${total}` : "Interview prep"

  return (
    <Collapsible
      open={open}
      onOpenChange={() => dispatch({ type: "toggled" })}
      render={<section />}
      aria-label={name}
      className="flex flex-col"
    >
      <div className="flex items-center gap-2">
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 justify-start gap-2 px-0 text-ui font-medium text-muted-foreground hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-muted-foreground md:h-6"
            />
          }
        >
          <CollapsibleIndicator className="size-[13px]" />
          <span>Interview prep</span>
          {total > 0 ? (
            <span
              className={cn(
                "text-xs leading-[15px] font-normal",
                FAINT_TEXT.card
              )}
            >
              {done}/{total}
            </span>
          ) : null}
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Add a step"
          className="-my-1 size-11 text-muted-foreground md:size-6"
          onClick={() => {
            dispatch({ type: "add_started" })
          }}
        >
          <Plus aria-hidden className="size-3.5" />
        </Button>
      </div>
      <CollapsibleContent className="mt-1.5 flex flex-col">
        {job.checklist.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            onToggle={() =>
              void catalogClient
                .run(queryClient, "job.setChecklistItem", {
                  jobId: job.id,
                  itemId: item.id,
                  done: !item.done,
                })
                .catch(reportRejected("update this prep step"))
            }
          />
        ))}
        {adding ? (
          <form
            className="flex flex-col px-2"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = jobAddChecklistItemInputSchema.safeParse({
                jobId: job.id,
                label: step,
              })
              if (!parsed.success) {
                const labelIssue = parsed.error.issues.find(
                  (issue) => issue.path[0] === "label"
                )
                const message =
                  labelIssue?.code === "too_big"
                    ? `Keep a prep step to ${labelIssue.maximum} characters or fewer.`
                    : labelIssue?.code === "too_small"
                      ? "Enter a prep step."
                      : "Check this prep step and try again."
                dispatch({ type: "message_set", message })
                return
              }
              dispatch({ type: "message_cleared" })
              void catalogClient
                .run(queryClient, "job.addChecklistItem", parsed.data)
                .then(() => dispatch({ type: "step_added" }))
                .catch(() =>
                  dispatch({
                    type: "message_set",
                    message: "Could not add this prep step. Try again.",
                  })
                )
            }}
          >
            <div className="flex h-[34px] items-center gap-2.5">
              <span
                aria-hidden
                className="size-[15px] shrink-0 rounded-full ring-[1.2px] ring-input ring-inset"
              />
              <Input
                aria-label="Add a step"
                aria-describedby={`${messageId}-hint${message ? ` ${messageId}` : ""}`}
                aria-invalid={message ? true : undefined}
                autoFocus
                value={step}
                placeholder="Add a step"
                className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:h-7 md:text-[13.5px]"
                onChange={(event) =>
                  dispatch({ type: "step_typed", value: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    dispatch({ type: "add_cancelled" })
                  }
                }}
              />
            </div>
            {PREP_STEP_MAX_LENGTH !== null ? (
              <p
                id={`${messageId}-hint`}
                className="pb-1 text-xs text-muted-foreground"
              >
                Up to {PREP_STEP_MAX_LENGTH} characters.
              </p>
            ) : null}
            {message ? (
              <p
                id={messageId}
                role="alert"
                className="pb-1 text-xs text-destructive"
              >
                {message}
              </p>
            ) : null}
          </form>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

function Comment({ row, author }: { row: ActivityFeedRow; author: string }) {
  const zone = useChosenTimeZone()
  return (
    <li
      data-slot="comment"
      className="my-2.5 flex flex-col gap-1.5 rounded-lg border border-border px-3.5 py-3"
    >
      <div className="flex items-center gap-2">
        <InitialsAvatar
          initials={companyInitials(author)}
          size={20}
          fontSize={8}
        />
        <span className="text-xs font-medium text-foreground">{author}</span>
        <time
          dateTime={row.createdAt}
          className={cn("text-xs", FAINT_TEXT.card)}
        >
          {monthDay(new Date(row.createdAt), zone)}
        </time>
      </div>
      <p
        className={cn(
          "text-[13.5px] leading-[1.55] break-words whitespace-pre-wrap",
          TITLE_TEXT
        )}
      >
        {row.summary}
      </p>
    </li>
  )
}

type NoteState = {
  note: string
  message: { text: string; invalid: boolean } | null
}
type NoteAction =
  | { type: "typed"; value: string }
  | { type: "invalid" }
  | { type: "failed" }
  | { type: "saved" }

function noteReducer(state: NoteState, action: NoteAction): NoteState {
  if (action.type === "typed") return { note: action.value, message: null }
  if (action.type === "invalid") {
    return {
      ...state,
      message: {
        text:
          NOTE_MAX_LENGTH !== null
            ? `Keep a note to ${NOTE_MAX_LENGTH.toLocaleString()} characters or fewer.`
            : "Check the note and try again.",
        invalid: true,
      },
    }
  }
  if (action.type === "failed") {
    return {
      ...state,
      message: { text: "Could not save the note. Try again.", invalid: false },
    }
  }
  return { note: "", message: null }
}

function NoteComposer({ jobId }: { jobId: JobId }) {
  const queryClient = useQueryClient()
  const hintId = useId()
  const messageId = useId()
  const [state, dispatch] = useReducer(noteReducer, {
    note: "",
    message: null,
  })

  async function submit() {
    const parsed = jobAddNoteInputSchema.safeParse({
      jobId,
      body: state.note,
    })
    if (!parsed.success) {
      dispatch({ type: "invalid" })
      return
    }
    if (!parsed.data.body) return
    try {
      await catalogClient.run(queryClient, "job.addNote", parsed.data)
      dispatch({ type: "saved" })
    } catch {
      dispatch({ type: "failed" })
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form
        className="flex min-h-11 items-center gap-2 rounded-lg border border-border py-1.5 pr-2 pl-3.5 focus-within:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Textarea
          aria-label="Leave a note"
          aria-describedby={
            [
              NOTE_MAX_LENGTH !== null ? hintId : null,
              state.message ? messageId : null,
            ]
              .filter(Boolean)
              .join("") || undefined
          }
          aria-invalid={state.message?.invalid || undefined}
          value={state.note}
          rows={1}
          placeholder="Leave a note…"
          className={cn(
            "min-h-11 flex-1 resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0 md:min-h-0 md:text-ui",
            NOTE_PLACEHOLDER
          )}
          onChange={(event) =>
            dispatch({ type: "typed", value: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
        />
        <Button
          type="submit"
          variant="ghost"
          aria-label="Leave a note"
          className="size-11 shrink-0 rounded-full p-0 hover:bg-transparent md:size-7"
        >
          <ArrowUp
            aria-hidden
            className="size-7 rounded-full bg-secondary p-[7px] text-muted-foreground"
          />
        </Button>
      </form>
      {NOTE_MAX_LENGTH !== null ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          Up to {NOTE_MAX_LENGTH.toLocaleString()} characters.
        </p>
      ) : null}
      {state.message ? (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {state.message.text}
        </p>
      ) : null}
    </div>
  )
}

const SHOWN_ELSEWHERE: ReadonlySet<string> = new Set<string>([
  catalog["job.star"].name,
  catalog["job.addChecklistItem"].name,
  catalog["job.setChecklistItem"].name,
])

export function JobDocument({
  job,
  rows,
  author,
}: {
  job: JobDetail
  rows: ActivityFeedRow[]
  author: string
}) {
  const ordered = rows
    .filter((row) => !SHOWN_ELSEWHERE.has(row.command))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const hasPrep = job.checklist.length > 0 || job.stage !== "closed"
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col">
      <h1 className="text-2xl leading-[29px] font-semibold tracking-[-0.5px] text-foreground">
        {job.title}
      </h1>
      <div className="mt-1.5 flex items-center gap-2">
        <Briefcase
          aria-hidden
          className="size-[22px] shrink-0 rounded-sm border border-foreground/8 bg-card p-1 text-foreground"
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
