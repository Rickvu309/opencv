import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import {
  newProofStep,
  PROOF_STEP_LABEL,
  type ProofData,
  type ProofPhoto,
  type ProofStep,
  type ProofStepType,
} from "./paper-proof-types.ts"

type Props = {
  data: ProofData
  onChange: (data: ProofData) => void
}

const STEP_CARD = "proof-step-card group"

const STEP_MARKER: Record<ProofStepType, string> = {
  context: "proof-step-marker proof-step-marker--context",
  action: "proof-step-marker proof-step-marker--action",
  outcome: "proof-step-marker proof-step-marker--outcome",
  note: "proof-step-marker proof-step-marker--note",
}

export function ProofDocument({ data, onChange }: Props) {
  function patch<K extends keyof ProofData>(key: K, value: ProofData[K]) {
    onChange({ ...data, [key]: value })
  }

  function patchStep(index: number, next: Partial<ProofStep>) {
    const steps = data.steps.map((s, i) =>
      i === index ? { ...s, ...next } : s
    )
    patch("steps", steps)
  }

  function addStep(type: ProofStepType = "note") {
    patch("steps", [...data.steps, newProofStep(type)])
  }

  function removeStep(index: number) {
    patch(
      "steps",
      data.steps.filter((_, i) => i !== index)
    )
  }

  function addPhoto(stepIndex: number, file: File) {
    const url = URL.createObjectURL(file)
    const photo: ProofPhoto = {
      id: `photo-${Date.now()}`,
      url,
      caption: file.name.replace(/\.[^.]+$/, ""),
    }
    const step = data.steps[stepIndex]
    if (!step) return
    patchStep(stepIndex, { photos: [...step.photos, photo] })
  }

  function removePhoto(stepIndex: number, photoId: string) {
    const step = data.steps[stepIndex]
    if (!step) return
    patchStep(stepIndex, {
      photos: step.photos.filter((p) => p.id !== photoId),
    })
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div>
          <Input
            value={data.title}
            onChange={(e) => patch("title", e.target.value)}
            className="h-auto border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm"
            aria-label="Proof title"
          />
          {data.subtitle ? (
            <p className="text-xs text-muted-foreground">{data.subtitle}</p>
          ) : null}
        </div>
      </div>

      {data.viewMode === "chain" ? (
        <ProofChainView
          steps={data.steps}
          onPatchStep={patchStep}
          onRemoveStep={removeStep}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
          onAddStep={addStep}
        />
      ) : (
        <ProofTimelineView
          steps={data.steps}
          onPatchStep={patchStep}
          onRemoveStep={removeStep}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
        />
      )}
    </div>
  )
}

type StepViewProps = {
  steps: ProofStep[]
  onPatchStep: (index: number, next: Partial<ProofStep>) => void
  onRemoveStep: (index: number) => void
  onAddPhoto: (index: number, file: File) => void
  onRemovePhoto: (index: number, photoId: string) => void
  onAddStep?: (type: ProofStepType) => void
}

function ProofChainView({
  steps,
  onPatchStep,
  onRemoveStep,
  onAddPhoto,
  onRemovePhoto,
  onAddStep,
}: StepViewProps) {
  return (
    <div className="proof-chain-canvas min-h-0 flex-1 overflow-auto p-8">
      <div className="flex min-w-max items-center gap-0 px-4 pb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <ChainNode
              step={step}
              index={index}
              onPatch={(next) => onPatchStep(index, next)}
              onRemove={() => onRemoveStep(index)}
              onAddPhoto={(file) => onAddPhoto(index, file)}
              onRemovePhoto={(id) => onRemovePhoto(index, id)}
            />
            {index < steps.length - 1 ? (
              <div
                className="flex w-9 shrink-0 items-center justify-center"
                aria-hidden
              >
                <ChevronRight
                  className="size-4 text-muted-foreground/25"
                  strokeWidth={1.5}
                />
              </div>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => onAddStep?.("note")}
                className="ml-2 size-9 shrink-0 rounded-xl border-dashed text-muted-foreground shadow-xs"
                aria-label="Add step"
              >
                <Plus className="size-4" strokeWidth={1.75} />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChainNode({
  step,
  index,
  onPatch,
  onRemove,
  onAddPhoto,
  onRemovePhoto,
}: {
  step: ProofStep
  index: number
  onPatch: (next: Partial<ProofStep>) => void
  onRemove: () => void
  onAddPhoto: (file: File) => void
  onRemovePhoto: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn("w-[17rem] shrink-0", STEP_CARD)}>
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <p className="text-2xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {PROOF_STEP_LABEL[step.type]}
          </p>
          <p className="mt-0.5 text-micro text-muted-foreground/60 tabular-nums">
            Step {String(index + 1).padStart(2, "0")}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          className="text-muted-foreground opacity-0 group-hover:opacity-100"
          aria-label="Remove step"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </Button>
      </div>

      <div className="px-3.5 pb-3.5">
        <Input
          value={step.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          className="mb-2 h-auto w-full border-0 bg-transparent px-0 text-sm leading-snug font-semibold shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm"
          aria-label={`Step ${index + 1} title`}
        />
        <Textarea
          value={step.body}
          onChange={(e) => onPatch({ body: e.target.value })}
          rows={4}
          className="min-h-0 w-full resize-none border-0 bg-transparent px-0 py-0 text-xs leading-relaxed text-foreground/80 shadow-none focus-visible:border-0 focus-visible:ring-0"
          aria-label={`Step ${index + 1} body`}
        />

        <PhotoStrip
          photos={step.photos}
          onAdd={() => fileRef.current?.click()}
          onRemove={onRemovePhoto}
          compact
        />
        {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onAddPhoto(file)
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}

function ProofTimelineView({
  steps,
  onPatchStep,
  onRemoveStep,
  onAddPhoto,
  onRemovePhoto,
}: StepViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = steps.reduce<Record<string, ProofStep[]>>((acc, step) => {
    const key = step.date ?? "Undated"
    acc[key] = acc[key] ?? []
    acc[key].push(step)
    return acc
  }, {})

  return (
    <div className="min-h-0 flex-1 overflow-auto px-6 py-6 sm:px-10">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold">Timeline preview</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setCollapsed({})}
          >
            Expand all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              const all: Record<string, boolean> = {}
              steps.forEach((s) => {
                all[s.id] = true
              })
              setCollapsed(all)
            }}
          >
            Collapse all
          </Button>
        </div>
      </div>

      {Object.entries(grouped).map(([date, dateSteps]) => (
        <div key={date} className="mb-8">
          <p className="mb-4 text-xs font-medium text-muted-foreground">
            {date}
          </p>
          <div className="relative space-y-0">
            <div
              className="absolute top-2 bottom-2 left-[4.25rem] w-px bg-border"
              aria-hidden
            />
            {dateSteps.map((step) => {
              const globalIndex = steps.findIndex((s) => s.id === step.id)
              const isCollapsed = collapsed[step.id]
              return (
                <TimelineRow
                  key={step.id}
                  step={step}
                  isCollapsed={isCollapsed}
                  onToggle={() =>
                    setCollapsed((c) => ({ ...c, [step.id]: !c[step.id] }))
                  }
                  onPatch={(next) => onPatchStep(globalIndex, next)}
                  onRemove={() => onRemoveStep(globalIndex)}
                  onAddPhoto={(file) => onAddPhoto(globalIndex, file)}
                  onRemovePhoto={(id) => onRemovePhoto(globalIndex, id)}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function TimelineRow({
  step,
  isCollapsed,
  onToggle,
  onPatch,
  onRemove,
  onAddPhoto,
  onRemovePhoto,
}: {
  step: ProofStep
  isCollapsed: boolean
  onToggle: () => void
  onPatch: (next: Partial<ProofStep>) => void
  onRemove: () => void
  onAddPhoto: (file: File) => void
  onRemovePhoto: (id: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative flex gap-4 pb-6">
      <p className="w-12 shrink-0 pt-1 text-right text-micro text-muted-foreground tabular-nums">
        {step.time ?? "—"}
      </p>

      <div
        className={cn(
          "relative z-10 mt-1 size-2 shrink-0 rounded-full ring-2 ring-background",
          STEP_MARKER[step.type]
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggle}
            className="h-auto min-w-0 flex-1 justify-start gap-1 px-0 py-0 text-left hover:bg-transparent"
          >
            {isCollapsed ? (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium">{step.title}</span>
            <span className="shrink-0 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-2xs font-medium text-secondary-foreground uppercase">
              {step.type}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Delete step"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        {!isCollapsed ? (
          <div className="mt-2 rounded-lg border border-border bg-card p-3 shadow-sm">
            <Textarea
              value={step.body}
              onChange={(e) => onPatch({ body: e.target.value })}
              rows={3}
              className="min-h-0 w-full resize-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed shadow-none focus-visible:border-0 focus-visible:ring-0"
              aria-label="Step body"
            />
            <PhotoStrip
              photos={step.photos}
              onAdd={() => fileRef.current?.click()}
              onRemove={onRemovePhoto}
            />
            {/* Documented exception: native file input — kit Input cannot host a hidden file picker. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onAddPhoto(file)
                e.target.value = ""
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PhotoStrip({
  photos,
  onAdd,
  onRemove,
  compact,
}: {
  photos: ProofPhoto[]
  onAdd: () => void
  onRemove: (id: string) => void
  compact?: boolean
}) {
  if (photos.length === 0 && !onAdd) return null

  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mt-2" : "mt-3")}>
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative overflow-hidden rounded-lg bg-muted/30"
        >
          <img
            src={photo.url}
            alt={photo.caption ?? "Proof photo"}
            className={cn(
              "proof-photo object-cover",
              compact ? "size-14" : "h-20 w-28"
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(photo.id)}
            className="absolute top-0.5 right-0.5 size-5 rounded bg-black/50 text-white opacity-0 hover:bg-black/60 hover:text-white group-hover:opacity-100"
            aria-label="Remove photo"
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className={cn(
          "flex items-center justify-center rounded-lg border-dashed border-border/80 bg-card text-muted-foreground shadow-[0_1px_2px_oklch(0_0_0/0.04)] hover:border-foreground/20 hover:text-foreground",
          compact ? "size-14 rounded-md" : "h-20 w-28"
        )}
        aria-label="Add photo"
      >
        <ImagePlus className="size-4" />
      </Button>
    </div>
  )
}
