import { useState } from "react"
import {
  blockRegistry,
  type CvBlock,
  type CvBlockDocument,
  type CvSectionKind,
  type PaperView,
  type PaperTemplateId,
} from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"
import { Plus } from "lucide-react"
import { CvA4Canvas } from "./paper-cv-a4.tsx"
import { printLayout } from "./paper-templates.ts"
import { BlockField } from "./paper-canvas-field.tsx"
import { makeId, emptyBlock } from "./paper-block-operations.ts"
import { PaperEditorBlock } from "./paper-editor-block.tsx"
import { CvPhoto } from "./cv-templates/cv-parts.tsx"

type Props = {
  document: CvBlockDocument
  checks: PaperView["checks"]
  sourceFileName: string | null
  templateId?: PaperTemplateId
  onChange: (document: CvBlockDocument) => void
  onAskCoach: () => void
  onDismissCheck: (checkId: string) => void
}

const sectionNames: Record<CvSectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  activities: "Activities",
  awards: "Awards",
  languages: "Languages",
}
const sectionKinds: CvSectionKind[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "activities",
  "awards",
  "languages",
]
function sectionLayoutClass(layout: string, kind: CvSectionKind) {
  if (layout === "product") {
    return kind === "skills" || kind === "languages"
      ? "col-start-1 rounded-lg border border-border bg-muted/30 p-3"
      : "col-start-2"
  }
  if (layout === "service") {
    return kind === "skills" || kind === "education" || kind === "projects"
      ? "col-span-1"
      : "col-span-2"
  }
  if (layout === "academic") return "border-b border-border pb-2"
  if (layout === "photo") return "border-l-2 border-border pl-3"
  return ""
}

export function PaperBlockEditor({
  document,
  checks,
  sourceFileName,
  templateId = "simple",
  onChange,
  onAskCoach,
  onDismissCheck,
}: Props) {
  const [slashSection, setSlashSection] = useState<string | null>(null)
  const [dragBlock, setDragBlock] = useState<string | null>(null)
  const unresolvedChecks = checks.filter((check) => !check.resolved)
  const layout = printLayout(templateId)
  const layoutClass = {
    internship: "cv-template-internship",
    product: "cv-template-product",
    service: "cv-template-service",
    academic: "cv-template-academic",
    photo: "cv-template-photo",
  }[layout]

  function updateHeader(key: keyof CvBlockDocument["header"], value: string) {
    onChange({ ...document, header: { ...document.header, [key]: value } })
  }

  function updateSection(
    sectionId: string,
    update: (blocks: CvBlock[]) => CvBlock[]
  ) {
    onChange({
      ...document,
      sections: document.sections.map((section) =>
        section.id === sectionId
          ? { ...section, blocks: update(section.blocks) }
          : section
      ),
    })
  }

  function updateBlock(
    sectionId: string,
    blockId: string,
    update: (block: CvBlock) => CvBlock
  ) {
    updateSection(sectionId, (blocks) =>
      blocks.map((block) => (block.id === blockId ? update(block) : block))
    )
  }

  function addSection(kind: CvSectionKind) {
    if (document.sections.some((section) => section.kind === kind)) {
      setSlashSection(null)
      return
    }
    onChange({
      ...document,
      sections: [...document.sections, { id: makeId(), kind, blocks: [] }],
    })
    setSlashSection(null)
  }

  function addBlock(sectionId: string, type: string) {
    const block = emptyBlock(type)
    if (block) updateSection(sectionId, (blocks) => [...blocks, block])
    setSlashSection(null)
  }

  function moveBlock(sectionId: string, blockId: string, offset: number) {
    updateSection(sectionId, (blocks) => {
      const from = blocks.findIndex((block) => block.id === blockId)
      const to = from + offset
      if (from < 0 || to < 0 || to >= blocks.length) return blocks
      const reordered = [...blocks]
      const [block] = reordered.splice(from, 1)
      if (block) reordered.splice(to, 0, block)
      return reordered
    })
  }

  function dropBlock(sectionId: string, targetId: string) {
    if (!dragBlock || dragBlock === targetId) return
    updateSection(sectionId, (blocks) => {
      const from = blocks.findIndex((block) => block.id === dragBlock)
      const to = blocks.findIndex((block) => block.id === targetId)
      if (from < 0 || to < 0) return blocks
      const reordered = [...blocks]
      const [block] = reordered.splice(from, 1)
      if (block) reordered.splice(to, 0, block)
      return reordered
    })
    setDragBlock(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      {sourceFileName ? (
        <aside
          aria-label="Import checks"
          className="mx-auto flex w-full flex-col gap-3 sm:max-w-4xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm font-medium">
              Imported from {sourceFileName}
            </p>
            {unresolvedChecks.length ? (
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {unresolvedChecks.length} to check
              </span>
            ) : null}
          </div>
          {unresolvedChecks
            .filter((check) => check.kind === "phone" || check.kind === "dates")
            .map((check) => {
              const isPhone = check.kind === "phone"
              return (
                <div
                  key={check.id}
                  className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:max-w-xl"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {isPhone ? "Phone missing" : "Dates missing"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Dismiss ${isPhone ? "phone" : "dates"} check`}
                      onClick={() => onDismissCheck(check.id)}
                    >
                      ×
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isPhone
                      ? "No phone number in your file."
                      : "Add when you did this role."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (isPhone) {
                          globalThis.document
                            .querySelector<HTMLInputElement>(
                              '[aria-label="Phone"]'
                            )
                            ?.focus()
                          return
                        }
                        const block = [
                          ...globalThis.document.querySelectorAll<HTMLElement>(
                            "[data-block-id]"
                          ),
                        ].find((node) => node.dataset.blockId === check.blockId)
                        const period =
                          block?.querySelector<HTMLInputElement>(
                            '[aria-label="Period"]'
                          ) ??
                          globalThis.document.querySelector<HTMLInputElement>(
                            '[aria-label="Period"]'
                          )
                        period?.focus()
                      }}
                    >
                      {isPhone ? "Add phone" : "Add dates"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onDismissCheck(check.id)}
                    >
                      Skip
                    </Button>
                  </div>
                </div>
              )
            })}
        </aside>
      ) : null}
      <CvA4Canvas preview className="py-2">
        <div
          className={`cv-template-root ${layoutClass}`}
          role="region"
          aria-label="CV block canvas"
        >
          <header
            className={`mb-6 ${
              layout === "academic"
                ? "border-b-2 border-foreground pb-3"
                : layout === "photo"
                  ? "flex items-start gap-5 border-b border-border pb-4"
                  : layout === "internship"
                    ? "text-left"
                    : "border-b border-border pb-3 text-left"
            }`}
          >
            {layout === "photo" ? (
              <CvPhoto
                url={document.header.photo}
                onChange={(photo) =>
                  onChange({
                    ...document,
                    header: { ...document.header, photo },
                  })
                }
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <BlockField
                label="Name"
                value={document.header.name}
                placeholder="Your name"
                className="cv-type-page-title h-10 text-left font-bold"
                onChange={(value) => updateHeader("name", value)}
              />
              <div
                className={`mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground ${
                  layout === "academic"
                    ? "justify-end text-right"
                    : "justify-start"
                }`}
              >
                <BlockField
                  label="Email"
                  value={document.header.email}
                  className={`w-24 text-xs ${layout === "academic" ? "text-right" : "text-left"}`}
                  onChange={(value) => updateHeader("email", value)}
                />
                <BlockField
                  label="Phone"
                  value={document.header.phone}
                  className={`w-24 text-xs ${layout === "academic" ? "text-right" : "text-left"}`}
                  onChange={(value) => updateHeader("phone", value)}
                />
                <BlockField
                  label="City"
                  value={document.header.city}
                  className={`w-24 text-xs ${layout === "academic" ? "text-right" : "text-left"}`}
                  onChange={(value) => updateHeader("city", value)}
                />
                <BlockField
                  label="LinkedIn"
                  value={document.header.linkedin}
                  className={`w-24 text-xs ${layout === "academic" ? "text-right" : "text-left"}`}
                  onChange={(value) => updateHeader("linkedin", value)}
                />
              </div>
            </div>
          </header>
          <div
            className={
              layout === "product"
                ? "grid grid-cols-[32%_1fr] items-start gap-x-5 gap-y-4"
                : layout === "service"
                  ? "grid grid-cols-2 items-start gap-5"
                  : "flex flex-col gap-5"
            }
          >
            {document.sections.map((section) => (
              <section
                key={section.id}
                className={`group ${sectionLayoutClass(layout, section.kind)}`}
                tabIndex={0}
                aria-label={`${sectionNames[section.kind]} section`}
                onKeyDown={(event) => {
                  if (
                    event.key === "/" &&
                    event.target === event.currentTarget
                  ) {
                    event.preventDefault()
                    setSlashSection(section.id)
                  }
                }}
              >
                <div className="paper-canvas-block mb-2 flex items-center gap-2 border-b border-border pb-1">
                  <h2 className="flex-1 text-xs font-semibold tracking-wide uppercase">
                    {sectionNames[section.kind]}
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Add block to ${sectionNames[section.kind]}`}
                    className="paper-canvas-affordance"
                    onClick={() =>
                      setSlashSection(
                        slashSection === section.id ? null : section.id
                      )
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="paper-canvas-affordance"
                    onClick={() => {
                      onChange({
                        ...document,
                        sections: document.sections.filter(
                          (item) => item.id !== section.id
                        ),
                      })
                      setSlashSection(null)
                    }}
                  >
                    Remove section
                  </Button>
                </div>
                {section.blocks.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    Click + or press / to add a block.
                  </p>
                ) : null}
                <div className="flex flex-col gap-1">
                  {section.blocks.map((block, index) => (
                    <PaperEditorBlock
                      key={block.id}
                      sectionId={section.id}
                      block={block}
                      index={index}
                      updateBlock={updateBlock}
                      updateSection={updateSection}
                      moveBlock={moveBlock}
                      dropBlock={dropBlock}
                      setDragBlock={setDragBlock}
                      onAskCoach={onAskCoach}
                    />
                  ))}
                </div>
                {slashSection === section.id ? (
                  <div
                    role="group"
                    aria-label="Insert block"
                    className="mt-2 flex max-w-sm flex-col rounded-lg border border-border bg-popover p-1 shadow-md"
                  >
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Sections
                    </p>
                    {sectionKinds.map((kind) => (
                      <Button
                        key={kind}
                        type="button"
                        variant="ghost"
                        className="justify-start"
                        onClick={() => addSection(kind)}
                        disabled={document.sections.some(
                          (item) => item.kind === kind
                        )}
                      >
                        {sectionNames[kind]}
                      </Button>
                    ))}
                    <div className="my-1 border-t border-border" />
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Blocks
                    </p>
                    {blockRegistry
                      .filter((entry) => entry.slash)
                      .map((entry) => (
                        <Button
                          key={entry.type}
                          type="button"
                          variant="ghost"
                          className="justify-start"
                          onClick={() => addBlock(section.id, entry.type)}
                        >
                          {entry.slash?.label}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {entry.slash?.hint}
                          </span>
                        </Button>
                      ))}
                  </div>
                ) : null}
              </section>
            ))}
          </div>
          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSlashSection(document.sections.at(-1)?.id ?? "__new__")
              }
            >
              Add section
            </Button>
            {document.sections.length === 0 && slashSection === "__new__" ? (
              <div
                role="group"
                aria-label="Insert section"
                className="mt-2 flex max-w-sm flex-col rounded-lg border border-border bg-popover p-1 shadow-md"
              >
                {sectionKinds.map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    variant="ghost"
                    className="justify-start"
                    onClick={() => addSection(kind)}
                  >
                    {sectionNames[kind]}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </CvA4Canvas>
    </div>
  )
}
