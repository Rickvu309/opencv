import { SAMPLE_AUTHOR } from "@/features/seed/sample-author.ts"

import "./design/paper-picture.css"

const LINES = [4, 5, 3]

export function PaperLetterArt({ className }: { className?: string }) {
  return (
    <span
      className={`paper-picture paper-letter-art${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <span className="paper-picture-text paper-letter-art-text">
        <span className="paper-letter-from">
          <b>{SAMPLE_AUTHOR.name}</b>
          <span>{SAMPLE_AUTHOR.email}</span>
          <span>Ho Chi Minh City</span>
        </span>
        <span className="paper-letter-date">18 November 2026</span>
        <span className="paper-letter-to">Hiring Manager</span>
        <span className="paper-letter-greet">Dear Hiring Manager,</span>
        {LINES.map((count) => (
          <span className="paper-letter-para" key={count}>
            {Array.from({ length: count }, (_, index) => (
              <span
                className={
                  index === count - 1
                    ? "paper-letter-line is-short"
                    : "paper-letter-line"
                }
                key={index}
              />
            ))}
          </span>
        ))}
        <span className="paper-letter-close">Sincerely,</span>
        <span className="paper-letter-sign">{SAMPLE_AUTHOR.name}</span>
        <span className="paper-letter-who">{SAMPLE_AUTHOR.name}</span>
      </span>
    </span>
  )
}
