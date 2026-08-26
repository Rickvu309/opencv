import { useMemo, useState, type ReactNode } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import type { ApplyStage, PaperContentKind } from "@workspace/domain"
import { PAPER_KIND_LABEL } from "@workspace/domain"

import { STAGES } from "@/features/apply/apply-types.ts"
import { CoachMarkdown } from "@/features/home/coach-markdown.tsx"
import { CreateDocReceipt } from "@/features/coach-receipt-prototypes/create-doc-receipt.tsx"
import {
  CREATE_DOC_FIXTURES,
  FAILURE_SUMMARIES,
  genericToolPart,
  MOVE_CARD_FIXTURE,
  UPDATE_CONTENT_FIXTURES,
  type UpdateContentKind,
} from "@/features/coach-receipt-prototypes/fixtures.ts"
import { GenericReceiptLine } from "@/features/coach-receipt-prototypes/generic-line.tsx"
import { MoveCardReceipt } from "@/features/coach-receipt-prototypes/move-card-receipt.tsx"
import {
  GRADUATION_NOTES,
  PROTOTYPE_CHOICE,
} from "@/features/coach-receipt-prototypes/notes.ts"
import { CompareBlock } from "@/features/coach-receipt-prototypes/receipt-frame.tsx"
import { UpdateContentReceipt } from "@/features/coach-receipt-prototypes/update-content-receipt.tsx"

type Pane = "thread" | "update" | "move" | "create" | "notes"

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(85%,28rem)] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function CoachTurn({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <CoachMarkdown text={text} />
      {children}
    </div>
  )
}

function PrototypeNotice({
  message,
  onClear,
}: {
  message: string | null
  onClear: () => void
}) {
  if (!message) return null
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs"
    >
      <p>{message}</p>
      <Button type="button" variant="ghost" size="xs" onClick={onClear}>
        Dismiss
      </Button>
    </div>
  )
}

function KindChips({
  value,
  onChange,
}: {
  value: PaperContentKind
  onChange: (kind: PaperContentKind) => void
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Paper kind"
    >
      {(["cv", "letter", "proof"] as const).map((kind) => (
        <Button
          key={kind}
          type="button"
          size="xs"
          variant={value === kind ? "default" : "outline"}
          aria-pressed={value === kind}
          onClick={() => onChange(kind)}
        >
          {PAPER_KIND_LABEL[kind]}
        </Button>
      ))}
    </div>
  )
}

function OutcomeChips({
  ok,
  onChange,
}: {
  ok: boolean
  onChange: (ok: boolean) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Outcome">
      <Button
        type="button"
        size="xs"
        variant={ok ? "default" : "outline"}
        aria-pressed={ok}
        onClick={() => onChange(true)}
      >
        Success
      </Button>
      <Button
        type="button"
        size="xs"
        variant={!ok ? "default" : "outline"}
        aria-pressed={!ok}
        onClick={() => onChange(false)}
      >
        Failure
      </Button>
    </div>
  )
}

function StageChips({
  label,
  value,
  onChange,
}: {
  label: string
  value: ApplyStage
  onChange: (stage: ApplyStage) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {STAGES.map((stage) => (
          <Button
            key={stage.id}
            type="button"
            size="xs"
            variant={value === stage.id ? "default" : "outline"}
            aria-pressed={value === stage.id}
            onClick={() => onChange(stage.id)}
          >
            {stage.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function CoachReceiptPrototypePage() {
  const [pane, setPane] = useState<Pane>("thread")
  const [updateKind, setUpdateKind] = useState<UpdateContentKind>("cv")
  const [updateOk, setUpdateOk] = useState(true)
  const [moveFrom, setMoveFrom] = useState<ApplyStage>(MOVE_CARD_FIXTURE.from)
  const [moveTo, setMoveTo] = useState<ApplyStage>(MOVE_CARD_FIXTURE.to)
  const [moveOk, setMoveOk] = useState(true)
  const [createKind, setCreateKind] = useState<PaperContentKind>("cv")
  const [createOk, setCreateOk] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const updateFixture = UPDATE_CONTENT_FIXTURES[updateKind]
  const createFixture = CREATE_DOC_FIXTURES[createKind]
  const moveFixture = useMemo(
    () => ({ ...MOVE_CARD_FIXTURE, from: moveFrom, to: moveTo }),
    [moveFrom, moveTo]
  )

  function openPaper() {
    setNotice("Prototype only — this does not open the live Paper surface.")
  }

  function openApply() {
    setNotice("Prototype only — this does not open the live Apply board.")
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">QVE-152</Badge>
            <Badge variant="secondary">Prototype</Badge>
          </div>
          <div>
            <h1 className="font-[ui-serif,Georgia,Cambria,serif] text-2xl font-normal tracking-tight">
              Per-command Coach receipts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Isolated preview. The live Thread still uses one generic line for
              every Command. Production receipt code is not wired to these
              cards.
            </p>
          </div>
          <Tabs value={pane} onValueChange={(value) => setPane(value as Pane)}>
            <TabsList variant="line" className="flex-wrap">
              <TabsTrigger value="thread">Thread</TabsTrigger>
              <TabsTrigger value="update">Update content</TabsTrigger>
              <TabsTrigger value="move">Move card</TabsTrigger>
              <TabsTrigger value="create">Create doc</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <PrototypeNotice message={notice} onClear={() => setNotice(null)} />

        {pane === "thread" ? (
          <div role="log" aria-label="Prototype Thread" className="space-y-8">
            <UserBubble text="Tighten the summary on my sample CV and make the campus club bullet more concrete." />
            <CoachTurn text="Updated the sample CV. The summary now names APM internships, and the club bullet includes the decision log.">
              <UpdateContentReceipt
                fixture={UPDATE_CONTENT_FIXTURES.cv}
                ok
                onOpen={openPaper}
              />
              <CompareBlock>
                <GenericReceiptLine
                  part={genericToolPart(
                    "paper.updateContent",
                    UPDATE_CONTENT_FIXTURES.cv.summary,
                    true,
                    UPDATE_CONTENT_FIXTURES.cv.reversal
                  )}
                />
              </CompareBlock>
            </CoachTurn>

            <UserBubble text="Move my starred card to Prep." />
            <CoachTurn text="Moved Associate PM intern at Local startup from Inbox to Prep. Next step is to attach the checkout Proof before you send.">
              <MoveCardReceipt
                fixture={MOVE_CARD_FIXTURE}
                ok
                onOpen={openApply}
              />
              <CompareBlock>
                <GenericReceiptLine
                  part={genericToolPart(
                    "apply.moveCard",
                    MOVE_CARD_FIXTURE.summary,
                    true,
                    MOVE_CARD_FIXTURE.reversal
                  )}
                />
              </CompareBlock>
            </CoachTurn>

            <UserBubble text="Start a blank CV I can fill for this role." />
            <CoachTurn text="Created a draft CV. It is empty on purpose — open Paper when you want to write, or ask me to draft from the sample.">
              <CreateDocReceipt
                fixture={CREATE_DOC_FIXTURES.cv}
                ok
                onOpen={openPaper}
              />
              <CompareBlock>
                <GenericReceiptLine
                  part={genericToolPart(
                    "paper.createDoc",
                    CREATE_DOC_FIXTURES.cv.summary,
                    true,
                    CREATE_DOC_FIXTURES.cv.reversal
                  )}
                />
              </CompareBlock>
            </CoachTurn>
          </div>
        ) : null}

        {pane === "update" ? (
          <section
            role="region"
            className="space-y-4"
            aria-label="paper.updateContent prototype"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <KindChips value={updateKind} onChange={setUpdateKind} />
              <OutcomeChips ok={updateOk} onChange={setUpdateOk} />
            </div>
            <UpdateContentReceipt
              fixture={updateFixture}
              ok={updateOk}
              errorSummary={FAILURE_SUMMARIES.updateContent}
              onOpen={openPaper}
            />
            <CompareBlock>
              <GenericReceiptLine
                part={genericToolPart(
                  "paper.updateContent",
                  updateOk
                    ? updateFixture.summary
                    : FAILURE_SUMMARIES.updateContent,
                  updateOk,
                  updateOk ? updateFixture.reversal : undefined
                )}
              />
            </CompareBlock>
          </section>
        ) : null}

        {pane === "move" ? (
          <section
            role="region"
            className="space-y-4"
            aria-label="apply.moveCard prototype"
          >
            <StageChips label="From" value={moveFrom} onChange={setMoveFrom} />
            <StageChips label="To" value={moveTo} onChange={setMoveTo} />
            <OutcomeChips ok={moveOk} onChange={setMoveOk} />
            <MoveCardReceipt
              fixture={moveFixture}
              ok={moveOk}
              errorSummary={FAILURE_SUMMARIES.moveCard}
              onOpen={openApply}
            />
            <CompareBlock>
              <GenericReceiptLine
                part={genericToolPart(
                  "apply.moveCard",
                  moveOk ? moveFixture.summary : FAILURE_SUMMARIES.moveCard,
                  moveOk,
                  moveOk ? moveFixture.reversal : undefined
                )}
              />
            </CompareBlock>
          </section>
        ) : null}

        {pane === "create" ? (
          <section
            role="region"
            className="space-y-4"
            aria-label="paper.createDoc prototype"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <KindChips value={createKind} onChange={setCreateKind} />
              <OutcomeChips ok={createOk} onChange={setCreateOk} />
            </div>
            <CreateDocReceipt
              fixture={createFixture}
              ok={createOk}
              errorSummary={FAILURE_SUMMARIES.createDoc}
              onOpen={openPaper}
            />
            <CompareBlock>
              <GenericReceiptLine
                part={genericToolPart(
                  "paper.createDoc",
                  createOk
                    ? createFixture.summary
                    : FAILURE_SUMMARIES.createDoc,
                  createOk,
                  createOk ? createFixture.reversal : undefined
                )}
              />
            </CompareBlock>
          </section>
        ) : null}

        {pane === "notes" ? (
          <section className="space-y-6" aria-label="Graduation notes">
            <p className="text-sm leading-relaxed">{PROTOTYPE_CHOICE}</p>
            {GRADUATION_NOTES.map((group) => (
              <div key={group.heading} className="space-y-2">
                <h2 className="text-sm font-semibold">{group.heading}</h2>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  )
}
