import type { ReactNode } from "react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Ellipsis,
  Highlighter,
  Image,
  IndentDecrease,
  IndentIncrease,
  Minus,
  RemoveFormatting,
  Rows3,
  Strikethrough,
  Table,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import {
  PAPER_FONTS,
  TEXT_STYLES,
  type Align,
  type PaperFont,
  type SelectionFormat,
  type TextStyle,
} from "./selection-format.ts"

const ALIGN_CHOICES = [
  { align: "left", label: "Left", icon: AlignLeft },
  { align: "center", label: "Center", icon: AlignCenter },
  { align: "right", label: "Right", icon: AlignRight },
  { align: "justify", label: "Justify", icon: AlignJustify },
] as const satisfies readonly { align: Align; label: string; icon: unknown }[]

export type MoreAction =
  | "strike"
  | "indent"
  | "outdent"
  | "lineSpacing"
  | "divider"
  | "table"
  | "clearFormatting"

type MenuProps = {
  format: SelectionFormat
  back: () => false
}

function ToolMenu({
  label,
  className,
  trigger,
  children,
  back,
}: {
  label: string
  className: string
  trigger: ReactNode
  children: ReactNode
  back: () => false
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="touch"
            className={`paper-tool ${className}`}
            aria-label={label}
            title={label}
          />
        }
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent finalFocus={back} aria-label={label}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StyleMenu({
  format,
  back,
  onStyle,
}: MenuProps & { onStyle: (kind: TextStyle) => void }) {
  const current = TEXT_STYLES.find((style) => style.kind === format.style)
  return (
    <ToolMenu
      label="Text style"
      className="paper-tool-menu paper-tool-style"
      back={back}
      trigger={
        <>
          <span className="paper-tool-label" data-style-label="">
            {current?.label ?? "Normal"}
          </span>
          <ChevronDown />
        </>
      }
    >
      <DropdownMenuRadioGroup
        value={format.style}
        onValueChange={(value) => onStyle(value as TextStyle)}
      >
        {TEXT_STYLES.map((style) => (
          <DropdownMenuRadioItem
            key={style.kind}
            value={style.kind}
            closeOnClick
            className="paper-menu-row"
          >
            <span className={`paper-style-sample paper-style-${style.kind}`}>
              {style.label}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </ToolMenu>
  )
}

export function FontMenu({
  format,
  back,
  onFont,
}: MenuProps & { onFont: (family: PaperFont) => void }) {
  const current =
    PAPER_FONTS.find((font) => font.family === format.font) ?? PAPER_FONTS[0]
  return (
    <ToolMenu
      label="Font"
      className="paper-tool-menu paper-tool-font"
      back={back}
      trigger={
        <>
          <span className="paper-tool-label">
            <span className="paper-tool-long">{current.family}</span>
            <span className="paper-tool-short">{current.short}</span>
          </span>
          <ChevronDown />
        </>
      }
    >
      <DropdownMenuRadioGroup
        value={format.font}
        onValueChange={(value) => onFont(value as PaperFont)}
      >
        {PAPER_FONTS.map((font) => (
          <DropdownMenuRadioItem
            key={font.family}
            value={font.family}
            closeOnClick
            className="paper-menu-row"
          >
            <span style={{ fontFamily: `"${font.css}"`, fontSize: 14 }}>
              {font.family}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <p className="paper-menu-note">
        Fonts that look the same in Word and PDF
      </p>
    </ToolMenu>
  )
}

export function AlignMenu({
  format,
  back,
  onAlign,
}: MenuProps & { onAlign: (align: Align) => void }) {
  const current =
    ALIGN_CHOICES.find((choice) => choice.align === format.align) ??
    ALIGN_CHOICES[0]
  const Icon = current.icon
  return (
    <ToolMenu
      label="Align"
      className="paper-tool-menu paper-tool-align"
      back={back}
      trigger={
        <>
          <Icon data-align={current.align} />
          <ChevronDown />
        </>
      }
    >
      <DropdownMenuRadioGroup
        value={format.align}
        onValueChange={(value) => onAlign(value as Align)}
      >
        {ALIGN_CHOICES.map((choice) => (
          <DropdownMenuRadioItem
            key={choice.align}
            value={choice.align}
            closeOnClick
            className="paper-menu-row"
          >
            <choice.icon />
            {choice.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </ToolMenu>
  )
}

function Unavailable({
  icon,
  label,
  reason,
}: {
  icon: ReactNode
  label: string
  reason: string
}) {
  return (
    <DropdownMenuItem disabled className="paper-menu-row" title={reason}>
      {icon}
      <span className="flex flex-col">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">{reason}</span>
      </span>
    </DropdownMenuItem>
  )
}

export function MoreMenu({
  format,
  back,
  onMore,
  photoReason,
}: MenuProps & { onMore: (action: MoreAction) => void; photoReason: string }) {
  const item = (action: MoreAction, icon: ReactNode, label: string) => (
    <DropdownMenuItem className="paper-menu-row" onClick={() => onMore(action)}>
      {icon}
      {label}
    </DropdownMenuItem>
  )
  return (
    <ToolMenu
      label="More"
      className="paper-tool-more"
      back={back}
      trigger={
        <>
          <Ellipsis />
          <span className="paper-tool-long">More</span>
        </>
      }
    >
      {item("strike", <Strikethrough />, "Strikethrough")}
      <Unavailable
        icon={<Highlighter />}
        label="Highlight"
        reason="Not in the Paper format yet"
      />
      {item("indent", <IndentIncrease />, "Increase indent")}
      {item("outdent", <IndentDecrease />, "Decrease indent")}
      {item(
        "lineSpacing",
        <Rows3 />,
        format.lineSpacing === null ? "Line spacing 1.5" : "Line spacing single"
      )}
      <DropdownMenuSeparator />
      {item("divider", <Minus />, "Divider line")}
      <Unavailable icon={<Image />} label="Photo" reason={photoReason} />
      {item("table", <Table />, "Table")}
      <DropdownMenuSeparator />
      {item("clearFormatting", <RemoveFormatting />, "Clear formatting")}
    </ToolMenu>
  )
}
