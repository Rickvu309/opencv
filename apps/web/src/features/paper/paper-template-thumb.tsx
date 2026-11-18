import type { PaperTemplateId } from "@workspace/domain"

import { templatePageLines } from "./paper-template-pages.ts"
import "./design/paper-picture.css"

export function TemplatePage({
  templateId,
  className,
}: {
  templateId: PaperTemplateId | "blank"
  className: string
}) {
  return (
    <span
      className={`paper-picture rounded-[4px] ${className}`}
      aria-hidden="true"
      data-template-page={templateId}
    >
      {templateId === "blank" ? null : (
        <span className="paper-picture-text paper-template-text">
          {templatePageLines(templateId).map((line, index) => (
            <span
              key={index}
              data-page-name={line.style === "Title" ? "" : undefined}
              data-page-heading={line.style === "Heading1" ? "" : undefined}
              data-page-line={line.style}
              className={line.center ? "text-center" : undefined}
            >
              {line.text}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
