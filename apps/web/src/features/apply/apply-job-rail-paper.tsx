import { Link } from "@tanstack/react-router"
import { FileText, Mail, PenLine, Plus, Search, X } from "lucide-react"
import { useEffectReducer, type EffectReducer } from "use-effect-reducer"

import { parsePaperId, type JobDetail } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"

import { reportRejected } from "@/lib/command-failure.ts"
import { useRunCommand } from "@/lib/contract-client.ts"

import { listPaper, type PaperListItem } from "./apply-api.ts"
import {
  RAIL_PICKER_ROW,
  RAIL_POPOVER,
  RAIL_ROW,
  RailLabel,
} from "./apply-detail-parts.tsx"
import { monthDay } from "./apply-stages.ts"
import { useChosenTimeZone } from "./apply-time-zone.ts"

type PickerDoc = PaperListItem & { status?: string; updatedAt?: string }

function docMeta(doc: PickerDoc, zone: string) {
  const draft = doc.status === "draft"
  if (!doc.updatedAt) return draft ? "Draft" : ""
  const edited = monthDay(new Date(doc.updatedAt), zone)
  return draft ? `Draft, edited ${edited}` : `Edited ${edited}`
}

type PickerList =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; docs: PickerDoc[] }

type PickerState = {
  open: boolean
  list: PickerList
  search: string
  request: number
}

type PickerEvent =
  | { type: "opened"; kind: "cv" | "letter" }
  | { type: "closed" }
  | { type: "search_typed"; value: string }
  | { type: "docs_loaded"; docs: PickerDoc[]; request: number }
  | { type: "docs_failed"; request: number }

const pickerReducer: EffectReducer<PickerState, PickerEvent> = (
  state,
  event,
  exec
) => {
  switch (event.type) {
    case "opened": {
      const request = state.request + 1
      exec((_state, _effect, dispatch) => {
        void listPaper(event.kind)
          .then((rows) =>
            dispatch({
              type: "docs_loaded",
              docs: rows.filter((row) => row.kind === event.kind),
              request,
            })
          )
          .catch(() => dispatch({ type: "docs_failed", request }))
      })
      return {
        ...state,
        open: true,
        list: { status: "loading" },
        search: "",
        request,
      }
    }
    case "closed":
      return { ...state, open: false }
    case "search_typed":
      return { ...state, search: event.value }
    case "docs_loaded":
      return event.request === state.request
        ? { ...state, list: { status: "ready", docs: event.docs } }
        : state
    case "docs_failed":
      return event.request === state.request
        ? { ...state, list: { status: "error" } }
        : state
  }
}

export function PaperRow({
  kind,
  job,
}: {
  kind: "cv" | "letter"
  job: JobDetail
}) {
  const run = useRunCommand()
  const zone = useChosenTimeZone()
  const linked = kind === "cv" ? job.linked.cv : job.linked.letter
  const [{ open, list, search }, dispatch] = useEffectReducer(pickerReducer, {
    open: false,
    list: { status: "loading" },
    search: "",
    request: 0,
  })
  const DocIcon = kind === "cv" ? FileText : Mail
  const addLabel = kind === "cv" ? "Add CV" : "Add cover letter"
  const noun = kind === "cv" ? "CVs" : "cover letters"
  const docs = list.status === "ready" ? list.docs : []
  const shown = docs.filter((doc) =>
    doc.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) =>
        dispatch(next ? { type: "opened", kind } : { type: "closed" })
      }
    >
      <PopoverTrigger
        render={
          <Button
            size="touch"
            type="button"
            variant="ghost"
            aria-label={
              linked
                ? `${kind === "cv" ? "CV" : "Cover letter"}: ${linked.name}`
                : addLabel
            }
            className={RAIL_ROW}
          />
        }
      >
        {linked ? (
          <FileText aria-hidden className="size-3.5 text-muted-foreground" />
        ) : (
          <Plus aria-hidden className="size-3.5 text-muted-foreground" />
        )}
        <RailLabel empty={!linked}>{linked ? linked.name : addLabel}</RailLabel>
      </PopoverTrigger>
      <PopoverContent align="start" className={RAIL_POPOVER}>
        <div className="flex h-8 items-center gap-2 border-b border-foreground/6 px-2">
          <Search aria-hidden className="size-[13px] text-muted-foreground" />
          <Input
            aria-label="Find in Paper"
            value={search}
            placeholder="Find in Paper"
            className="h-11 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 md:h-8 md:text-[12.5px]"
            onChange={(event) =>
              dispatch({ type: "search_typed", value: event.target.value })
            }
          />
        </div>
        <div className="mt-1 flex max-h-60 flex-col gap-0.5 overflow-y-auto overscroll-contain">
          {list.status === "loading" ? (
            <p
              role="status"
              className="px-2 py-3 text-sm text-muted-foreground"
            >
              Loading Paper…
            </p>
          ) : list.status === "error" ? (
            <>
              <p
                role="alert"
                className="px-2 py-3 text-sm text-muted-foreground"
              >
                Could not load Paper. Try again.
              </p>
              <Button
                size="touch-lg"
                type="button"
                variant="ghost"
                className={RAIL_PICKER_ROW}
                onClick={() => dispatch({ type: "opened", kind })}
              >
                Try again
              </Button>
            </>
          ) : shown.length === 0 ? (
            <>
              <p
                role="status"
                className="px-2 py-3 text-sm text-muted-foreground"
              >
                {docs.length === 0
                  ? `No ${noun} in Paper yet.`
                  : `No ${noun} match your search.`}
              </p>
              {search.trim() ? (
                <Button
                  size="touch-lg"
                  type="button"
                  variant="ghost"
                  className={RAIL_PICKER_ROW}
                  onClick={() => dispatch({ type: "search_typed", value: "" })}
                >
                  Clear search
                </Button>
              ) : null}
              {kind === "cv" && docs.length === 0 ? (
                <Link
                  to="/paper"
                  className="px-2 py-2 text-sm text-foreground hover:underline"
                >
                  Create a CV in Paper
                </Link>
              ) : null}
            </>
          ) : null}
          {shown.map((doc) => (
            <Button
              size="touch-lg"
              key={doc.id}
              type="button"
              variant="ghost"
              className={RAIL_PICKER_ROW}
              onClick={() => {
                void run("job.linkPaper", {
                  jobId: job.id,
                  docId: parsePaperId(doc.id),
                  kind,
                }).catch(reportRejected("link this paper"))
                dispatch({ type: "closed" })
              }}
            >
              <DocIcon aria-hidden className="size-3.5 text-muted-foreground" />
              <span className="flex min-w-0 flex-col items-start">
                <span className="truncate">{doc.name}</span>
                {docMeta(doc, zone) ? (
                  <span className="text-[11px] text-muted-foreground">
                    {docMeta(doc, zone)}
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
        {linked || kind === "letter" ? (
          <Separator className="my-0.5 bg-foreground/6" />
        ) : null}
        {linked ? (
          <Button
            size="touch"
            type="button"
            variant="ghost"
            className={RAIL_PICKER_ROW}
            onClick={() => {
              void run("job.unlinkPaper", { jobId: job.id, kind }).catch(
                reportRejected("remove this paper")
              )
              dispatch({ type: "closed" })
            }}
          >
            <X aria-hidden className="size-3.5 text-muted-foreground" />
            Remove
          </Button>
        ) : null}
        {kind === "letter" ? (
          <Link
            to="/paper"
            className="flex h-11 items-center gap-[9px] rounded-[6px] px-2 text-[12.5px] text-foreground hover:bg-secondary md:h-8"
          >
            <PenLine aria-hidden className="size-3.5 text-muted-foreground" />
            Write a new cover letter
          </Link>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
