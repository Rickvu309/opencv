import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronDown } from "lucide-react"

import { buttonVariants } from "@workspace/ui/components/button"
import { Field } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

import "../landing.css"
import { LandingFooter } from "../landing-footer.tsx"
import { LandingNav } from "../landing-nav.tsx"
import {
  filterHelpTopics,
  HELP_DESCRIPTION,
  HELP_EMPTY,
  HELP_HEADLINE,
  HELP_SEARCH_LABEL,
  HELP_STUCK_BODY,
  HELP_STUCK_LINK,
  HELP_STUCK_TITLE,
  HELP_SUBHEAD,
  HELP_TITLE,
  HELP_TOPICS,
} from "./help-copy.ts"
import { HelpFigure } from "./help-figures.tsx"
import "./help.css"

export function HelpPage() {
  const [query, setQuery] = useState("")
  const topics = filterHelpTopics(HELP_TOPICS, query)

  return (
    <div className="landing-root min-h-svh">
      <title>{HELP_TITLE}</title>
      <meta name="description" content={HELP_DESCRIPTION} />
      <LandingNav />
      <main className="landing-grid">
        <section
          className="landing-section landing-stack"
          aria-labelledby="help-title"
        >
          <h1 id="help-title" className="landing-section-title">
            {HELP_HEADLINE}
          </h1>
          <p className="landing-section-body">{HELP_SUBHEAD}</p>
          <div role="search" className="help-search">
            <Field label={HELP_SEARCH_LABEL}>
              <Input
                type="search"
                value={query}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
          </div>
        </section>
        {topics.length === 0 ? (
          <p role="status" className="landing-section help-empty">
            {HELP_EMPTY}
          </p>
        ) : (
          <>
            <nav
              aria-label="Help topics"
              className="landing-section help-topics"
            >
              {topics.map((topic) => (
                <article key={topic.id} className="help-topic">
                  <div className="help-figure-frame landing-gradient" data-soft>
                    <HelpFigure id={topic.id} />
                  </div>
                  <div className="help-topic-copy">
                    <p className="help-topic-title">
                      <Link
                        to="/help"
                        hash={topic.id}
                        className="help-topic-link"
                      >
                        {topic.title}
                      </Link>
                    </p>
                    <p className="help-topic-blurb">{topic.blurb}</p>
                  </div>
                </article>
              ))}
            </nav>
            {topics.map((topic) => (
              <section
                key={topic.id}
                id={topic.id}
                className="landing-section help-topic-section"
                aria-labelledby={`help-${topic.id}`}
              >
                <h2 id={`help-${topic.id}`} className="help-topic-heading">
                  {topic.title}
                </h2>
                <div className="help-faq">
                  {topic.questions.map((item) => (
                    <details key={item.id} className="help-question">
                      <summary>
                        <span>{item.question}</span>
                        <ChevronDown
                          className="help-chevron"
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="help-answer">
                        <p>{item.answer}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
        <section
          className="landing-section landing-stack"
          aria-labelledby="help-stuck"
        >
          <h2 id="help-stuck" className="landing-section-title">
            {HELP_STUCK_TITLE}
          </h2>
          <p className="landing-section-body">{HELP_STUCK_BODY}</p>
          <Link
            to="/sign-in"
            className={cn(
              buttonVariants({ size: "lg" }),
              "landing-pill landing-gradient"
            )}
          >
            {HELP_STUCK_LINK}
          </Link>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
