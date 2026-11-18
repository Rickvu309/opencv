import type { PaperTemplateId } from "@workspace/domain"

import {
  templatePageLines,
  type TemplatePageLine,
} from "./paper-template-pages.ts"

export const TEMPLATE_PAGE_CLASS =
  "@container relative block aspect-[17/22] w-full overflow-hidden rounded-[6px] border border-transparent bg-white text-black/85 [word-spacing:0.15em]"

const plain = (text: string) => text.replace(/[[\]]/g, "")

const barWidth = (text: string) =>
  `${Math.min(94, 28 + plain(text).length * 1.25)}%`

function PageLine({
  line,
  readable,
}: {
  line: TemplatePageLine
  readable: boolean
}) {
  if (line.style === "Title")
    return (
      <span
        data-page-name=""
        className="mb-[2.4cqw] block truncate text-center text-[7.2cqw] leading-[1.15] font-semibold tracking-[-0.01em]"
      >
        {plain(line.text)}
      </span>
    )
  if (line.style === "Heading1")
    return (
      <span
        data-page-heading=""
        className="mt-[3.6cqw] mb-[1.8cqw] block truncate border-b-[0.5cqw] border-black/70 pb-[0.6cqw] text-[4.6cqw] leading-[1.2] font-semibold"
      >
        {line.text}
      </span>
    )
  if (readable)
    return (
      <span
        data-page-line={line.style}
        className={`mb-[1cqw] block text-[3.1cqw] leading-[1.35] ${line.center ? "text-center" : ""}`}
      >
        {line.style === "ListBullet" ? "• " : ""}
        {plain(line.text)}
      </span>
    )
  return (
    <span
      data-page-line={line.style}
      className={`mb-[1.6cqw] flex items-center gap-[1.4cqw] ${line.center ? "justify-center" : ""}`}
    >
      {line.style === "ListBullet" ? (
        <span className="size-[1.4cqw] shrink-0 rounded-full bg-black/45" />
      ) : null}
      <span
        className="block h-[1.9cqw] rounded-full bg-black/18"
        style={{ width: barWidth(line.text) }}
      />
    </span>
  )
}

export function TemplatePage({
  templateId,
  readable = false,
}: {
  templateId: PaperTemplateId
  readable?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      data-template-page={templateId}
      className="absolute inset-0 overflow-hidden px-[9cqw] py-[9cqw]"
    >
      {templatePageLines(templateId).map((line, index) => (
        <PageLine key={index} line={line} readable={readable} />
      ))}
    </span>
  )
}

export function BlankPage() {
  return (
    <span
      aria-hidden="true"
      data-template-page="blank"
      className="absolute inset-0"
    />
  )
}
