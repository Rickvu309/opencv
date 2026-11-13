import { Plus } from "lucide-react"

import type { PaperTemplateId } from "@workspace/domain"

import {
  templatePageLines,
  type TemplatePageLine,
} from "./paper-template-pages.ts"

const LINE_CLASS: Record<TemplatePageLine["style"], string> = {
  Title: "text-[3.27cqw] leading-[1.2] font-bold mb-[0.5cqw]",
  Heading1:
    "mt-[2cqw] mb-[0.7cqw] border-b-[0.15cqw] border-current text-[2.12cqw] leading-[1.25] font-bold",
  ListBullet:
    "mb-[1cqw] ps-[3cqw] -indent-[1.8cqw] text-[1.8cqw] leading-[1.25] before:me-[1cqw] before:content-['•']",
  Normal: "mb-[1cqw] text-[1.8cqw] leading-[1.25]",
}

export const TEMPLATE_PAGE_CLASS =
  "@container relative block aspect-[1/1.294] w-full overflow-hidden rounded-[4px] border border-transparent bg-white text-black/85 shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_1px_3px_oklch(0_0_0/0.08)]"

export function TemplatePage({ templateId }: { templateId: PaperTemplateId }) {
  return (
    <span
      aria-hidden="true"
      data-template-page={templateId}
      className="absolute inset-0 overflow-hidden px-[11.76cqw] py-[11.76cqw] font-[Calibri,Carlito,ui-sans-serif,sans-serif]"
    >
      {templatePageLines(templateId).map((line, index) => (
        <span
          key={index}
          className={`block ${LINE_CLASS[line.style]}${line.center ? "text-center" : ""}`}
        >
          {line.text}
        </span>
      ))}
    </span>
  )
}

export function BlankPage() {
  return (
    <span
      aria-hidden="true"
      data-template-page="blank"
      className="absolute inset-0 grid place-items-center"
    >
      <Plus className="size-[14cqw] text-black/35" strokeWidth={1.5} />
    </span>
  )
}
