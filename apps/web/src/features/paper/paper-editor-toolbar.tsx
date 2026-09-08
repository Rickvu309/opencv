import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Briefcase,
  Copy,
  Download,
  FileText,
  GitBranch,
  GraduationCap,
  Highlighter,
  ImagePlus,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Plus,
  Printer,
  Redo2,
  RemoveFormatting,
  Sparkles,
  Strikethrough,
  Tag,
  Target,
  Underline,
  Undo2,
  Wand2,
} from "lucide-react"

import { CvTemplateDropdown } from "./paper-cv-template-picker.tsx"
import type { CvTemplateId } from "./paper-cv-types.ts"
import type { ProofStepType, ProofViewMode } from "./paper-proof-types.ts"
import {
  runEditorCommand,
  ToolbarButton,
  ToolbarDivider,
  ToolbarMenu,
  ToolbarMeta,
  ToolbarOverflowMenu,
  type MenuSection,
  ToolbarRoot,
  ToolbarSpacer,
  ToolbarToggle,
  ToolbarZone,
} from "./paper-toolbar-parts.tsx"

export type ToolbarVariant = "full" | "cv" | "proof" | "letter"

export type CvInsertId =
  | "experience"
  | "education"
  | "skill"
  | "project"
  | "section"
  | "photo"
export type LetterInsertId = "salutation" | "paragraph" | "signoff" | "ps"
export type ProofInsertId = ProofStepType | "photo"

type Props = {
  className?: string
  variant?: ToolbarVariant
  cvTemplateId?: CvTemplateId
  onCvTemplateChange?: (id: CvTemplateId) => void
  onCvInsert?: (id: CvInsertId) => void
  onCvTailor?: (role: string) => void
  onLetterInsert?: (id: LetterInsertId) => void
  proofViewMode?: ProofViewMode
  onProofViewModeChange?: (mode: ProofViewMode) => void
  onProofInsert?: (id: ProofInsertId) => void
  letterWordCount?: number
}

const TAILOR_ROLES = [
  {
    id: "apm-intern",
    label: "Associate PM intern",
    hint: "Lead with discovery and shipped experiments",
  },
  {
    id: "product-intern",
    label: "Product intern",
    hint: "Highlight side projects and club work",
  },
  {
    id: "business-analyst",
    label: "Business analyst intern",
    hint: "Emphasize data, flows, and requirements",
  },
  {
    id: "startup-pm",
    label: "Startup product role",
    hint: "Show speed, ownership, and user evidence",
  },
]

const CV_INSERT_ITEMS = [
  {
    id: "experience",
    label: "Experience",
    hint: "Role, company, and bullets",
    icon: <Briefcase className="size-3.5" />,
  },
  {
    id: "education",
    label: "Education",
    hint: "School, degree, and dates",
    icon: <GraduationCap className="size-3.5" />,
  },
  {
    id: "skill",
    label: "Skills",
    hint: "Grouped skill tags",
    icon: <Tag className="size-3.5" />,
  },
  {
    id: "project",
    label: "Project",
    hint: "What you built or shipped",
    icon: <Sparkles className="size-3.5" />,
  },
  {
    id: "section",
    label: "Custom section",
    hint: "Volunteering, awards, and more",
    icon: <FileText className="size-3.5" />,
  },
  {
    id: "photo",
    label: "Profile photo",
    hint: "Passport size, JPG or PNG",
    icon: <ImagePlus className="size-3.5" />,
  },
] as const

function handleOverflowAction(id: string) {
  switch (id) {
    case "style-p":
      runEditorCommand("formatBlock", "p")
      break
    case "style-h2":
      runEditorCommand("formatBlock", "h2")
      break
    case "style-h3":
      runEditorCommand("formatBlock", "h3")
      break
    case "underline":
      runEditorCommand("underline")
      break
    case "strike":
      runEditorCommand("strikeThrough")
      break
    case "highlight":
      runEditorCommand(
        "hiliteColor",
        getComputedStyle(document.documentElement)
          .getPropertyValue("--muted")
          .trim()
      )
      break
    case "align-left":
      runEditorCommand("justifyLeft")
      break
    case "align-center":
      runEditorCommand("justifyCenter")
      break
    case "align-right":
      runEditorCommand("justifyRight")
      break
    case "clear-format":
      runEditorCommand("removeFormat")
      break
    case "pdf":
    case "docx":
    case "copy":
      break
    case "print":
      window.print()
      break
  }
}

function formatOverflowSections(rich: boolean): MenuSection[] {
  const sections: MenuSection[] = [
    {
      label: "Block style",
      items: [
        { id: "style-p", label: "Body text", hint: "Default paragraph" },
        {
          id: "style-h2",
          label: "Section heading",
          hint: "Experience, education",
        },
        { id: "style-h3", label: "Subheading", hint: "Role or company line" },
      ],
    },
  ]

  if (rich) {
    sections.push({
      label: "Text",
      items: [
        {
          id: "underline",
          label: "Underline",
          icon: <Underline className="size-3.5" />,
        },
        {
          id: "strike",
          label: "Strikethrough",
          icon: <Strikethrough className="size-3.5" />,
        },
        {
          id: "highlight",
          label: "Highlight",
          icon: <Highlighter className="size-3.5" />,
        },
      ],
    })
    sections.push({
      label: "Alignment",
      items: [
        {
          id: "align-left",
          label: "Align left",
          icon: <AlignLeft className="size-3.5" />,
        },
        {
          id: "align-center",
          label: "Align center",
          icon: <AlignCenter className="size-3.5" />,
        },
        {
          id: "align-right",
          label: "Align right",
          icon: <AlignRight className="size-3.5" />,
        },
      ],
    })
  }

  sections.push({
    items: [
      {
        id: "clear-format",
        label: "Clear formatting",
        icon: <RemoveFormatting className="size-3.5" />,
      },
    ],
  })

  return sections
}

function FormatEssentials() {
  return (
    <>
      <ToolbarButton label="Undo" onMouseDown={() => runEditorCommand("undo")}>
        <Undo2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onMouseDown={() => runEditorCommand("redo")}>
        <Redo2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton label="Bold" onMouseDown={() => runEditorCommand("bold")}>
        <span className="text-xs font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        onMouseDown={() => runEditorCommand("italic")}
      >
        <span className="text-xs italic">I</span>
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        label="Bullet list"
        onMouseDown={() => runEditorCommand("insertUnorderedList")}
      >
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        onMouseDown={() => runEditorCommand("insertOrderedList")}
      >
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Insert link"
        onMouseDown={() => runEditorCommand("createLink", "https://")}
      >
        <Link2 className="size-3.5" />
      </ToolbarButton>
    </>
  )
}

export function PaperEditorToolbar({
  className,
  variant = "full",
  cvTemplateId,
  onCvTemplateChange,
  onCvInsert,
  onCvTailor,
  onLetterInsert,
  proofViewMode,
  onProofViewModeChange,
  onProofInsert,
  letterWordCount,
}: Props) {
  const rich = variant === "letter" || variant === "full"
  // CV fields are structured React state — execCommand Bold/Italic/lists
  // are dead theater. Letter/full stay rich-text. QVE-205.
  const showFormat = rich
  const toolbarLabel =
    variant === "cv"
      ? "CV tools"
      : variant === "letter"
        ? "Letter tools"
        : variant === "proof"
          ? "Proof tools"
          : "Document tools"

  return (
    <ToolbarRoot className={className} aria-label={toolbarLabel}>
      {variant === "cv" && cvTemplateId && onCvTemplateChange ? (
        <ToolbarZone>
          <CvTemplateDropdown
            value={cvTemplateId}
            onChange={onCvTemplateChange}
          />
          <ToolbarMenu
            label="Insert"
            icon={<Plus className="size-3.5" />}
            items={CV_INSERT_ITEMS.map((item) => ({ ...item }))}
            onSelect={(id) => onCvInsert?.(id as CvInsertId)}
          />
          <ToolbarMenu
            label="Tailor for role"
            shortLabel="Tailor"
            icon={<Target className="size-3.5" />}
            items={TAILOR_ROLES.map((r) => ({
              id: r.id,
              label: r.label,
              hint: r.hint,
            }))}
            onSelect={(id) => onCvTailor?.(id)}
          />
        </ToolbarZone>
      ) : null}

      {variant === "letter" ? (
        <ToolbarZone>
          <ToolbarMenu
            label="Insert"
            icon={<Plus className="size-3.5" />}
            items={[
              {
                id: "salutation",
                label: "Salutation",
                hint: "Dear hiring team,",
              },
              {
                id: "paragraph",
                label: "Paragraph",
                hint: "Body text block",
              },
              { id: "signoff", label: "Sign-off", hint: "Best, your name" },
              { id: "ps", label: "P.S.", hint: "Short postscript" },
            ]}
            onSelect={(id) => onLetterInsert?.(id as LetterInsertId)}
          />
          <ToolbarMenu
            label="Adjust tone"
            shortLabel="Tone"
            icon={<Wand2 className="size-3.5" />}
            items={[
              { id: "formal", label: "More formal" },
              { id: "warm", label: "Warmer" },
              { id: "shorter", label: "Shorter" },
              { id: "confident", label: "More confident" },
            ]}
            onSelect={() => undefined}
          />
          {letterWordCount != null ? (
            <ToolbarMeta>{letterWordCount} words</ToolbarMeta>
          ) : null}
        </ToolbarZone>
      ) : null}

      {variant === "proof" ? (
        <ToolbarZone>
          {proofViewMode && onProofViewModeChange ? (
            <ToolbarToggle
              ariaLabel="Proof view"
              value={proofViewMode}
              onChange={(id) => onProofViewModeChange(id as ProofViewMode)}
              options={[
                {
                  id: "chain",
                  label: "Chain",
                  icon: <GitBranch className="size-3.5" />,
                },
                {
                  id: "timeline",
                  label: "Timeline",
                  icon: <ListTree className="size-3.5" />,
                },
              ]}
            />
          ) : null}
          <ToolbarMenu
            label="Add step"
            icon={<Plus className="size-3.5" />}
            items={[
              {
                id: "context",
                label: "Context",
                hint: "The situation you were in",
              },
              { id: "action", label: "Action", hint: "What you did" },
              { id: "outcome", label: "Outcome", hint: "The result" },
              { id: "note", label: "Note", hint: "Extra detail" },
              {
                id: "photo",
                label: "Photo",
                hint: "Attach to the last step",
                icon: <ImagePlus className="size-3.5" />,
              },
            ]}
            onSelect={(id) => onProofInsert?.(id as ProofInsertId)}
          />
          <ToolbarButton
            label="Link to CV"
            onClick={() => onProofInsert?.("note")}
            className="!w-auto gap-1.5 px-2.5 text-xs font-medium"
          >
            <Link2 className="size-3.5" />
            <span className="hidden sm:inline">Link to CV</span>
          </ToolbarButton>
        </ToolbarZone>
      ) : null}

      {showFormat ? (
        <>
          {variant === "letter" ? <ToolbarDivider /> : null}
          <ToolbarZone>
            <FormatEssentials />
          </ToolbarZone>
          <ToolbarZone>
            <ToolbarOverflowMenu
              sections={formatOverflowSections(rich)}
              onSelect={handleOverflowAction}
            />
          </ToolbarZone>
        </>
      ) : null}

      <ToolbarSpacer />

      <ToolbarZone>
        <ToolbarMenu
          label="Export"
          icon={<Download className="size-3.5" />}
          align="end"
          items={[
            {
              id: "pdf",
              label: "Download PDF",
              icon: <FileText className="size-3.5" />,
            },
            {
              id: "docx",
              label: "Download Word",
              icon: <FileText className="size-3.5" />,
            },
            {
              id: "print",
              label: "Print",
              icon: <Printer className="size-3.5" />,
            },
            {
              id: "copy",
              label: "Copy text",
              icon: <Copy className="size-3.5" />,
            },
          ]}
          onSelect={handleOverflowAction}
        />
      </ToolbarZone>
    </ToolbarRoot>
  )
}
