import { useReducer } from "react"
import { ArrowRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import "./landing.css"
import "./stories.css"

import { LandingClose } from "./landing-sections.tsx"
import { LandingFooter } from "./landing-footer.tsx"
import { LandingNav } from "./landing-nav.tsx"
import snapshot from "./design/stories.snapshot.json"

const STORIES_TITLE = "opencv. Stories"
const STORIES_DESCRIPTION = snapshot.description

type Story = (typeof snapshot.stories)[number]

function StoryDialog({
  story,
  open,
  onOpenChange,
}: {
  story: Story | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const featured = snapshot.featured
  const subject = story ?? {
    name: featured.name,
    role: featured.role,
    quote: featured.quote,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-6 p-6">
        <DialogTitle className="sr-only">{subject.name}</DialogTitle>
        <blockquote className="text-base leading-relaxed text-foreground">
          <p>{subject.quote}</p>
        </blockquote>
        {story === null && (
          <dl className="flex flex-wrap gap-3">
            {featured.stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 rounded-xl bg-muted/60 px-4 py-3"
              >
                <dt className="text-[1.75rem] leading-none font-medium">
                  {stat.value}
                </dt>
                <dd className="text-sm text-muted-foreground">{stat.label}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-col gap-0.5 border-t pt-4">
          <p className="text-[0.9375rem] font-medium">{subject.name}</p>
          <p className="text-sm text-muted-foreground">{subject.role}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type StoryDialog = { open: boolean; story: Story | null }
type StoryDialogAction =
  | { type: "featured_opened" }
  | { type: "story_opened"; story: Story }
  | { type: "open_changed"; open: boolean }

function storyDialogReducer(
  state: StoryDialog,
  action: StoryDialogAction
): StoryDialog {
  switch (action.type) {
    case "featured_opened":
      return { open: true, story: null }
    case "story_opened":
      return { open: true, story: action.story }
    case "open_changed":
      return { ...state, open: action.open }
  }
}

export function StoriesPage() {
  const featured = snapshot.featured
  const [{ open: dialogOpen, story: activeStory }, dispatch] = useReducer(
    storyDialogReducer,
    { open: false, story: null }
  )

  function openFeatured() {
    dispatch({ type: "featured_opened" })
  }

  function openStory(story: Story) {
    dispatch({ type: "story_opened", story })
  }

  return (
    <div className="landing-root stories-root min-h-svh">
      <title>{STORIES_TITLE}</title>
      <meta name="description" content={STORIES_DESCRIPTION} />
      <LandingNav />
      <main className="landing-grid" aria-label="Stories">
        <div className="landing-section landing-inset landing-stack stories-header">
          <h1 className="text-[3rem] leading-none font-medium tracking-tight">
            {snapshot.title}
          </h1>
          <p className="text-[1.5rem] leading-snug text-muted-foreground">
            {snapshot.description}
          </p>
        </div>

        <section
          aria-label="Featured story"
          className="landing-section stories-featured-section"
        >
          <div className="stories-featured landing-gradient">
            <img
              src={featured.photo.src}
              alt={featured.photo.alt}
              width={featured.photo.width}
              height={featured.photo.height}
              decoding="async"
              className="stories-featured-photo"
            />
            <div className="stories-featured-body">
              <div className="stories-featured-top">
                <p className="text-sm text-foreground">{featured.context}</p>
                <blockquote>
                  <p className="stories-featured-quote">{featured.quote}</p>
                </blockquote>
              </div>
              <div className="stories-featured-bottom">
                <dl className="stories-stats">
                  {featured.stats.map((stat) => (
                    <div key={stat.label} className="stories-stat">
                      <dt className="stories-stat-label">{stat.label}</dt>
                      <dd className="stories-stat-value">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
                <hr className="stories-rule" />
                <div className="stories-person-row">
                  <div className="stories-person">
                    <p className="text-[0.9375rem] font-medium">
                      {featured.name}
                    </p>
                    <p className="text-sm text-foreground">{featured.role}</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={openFeatured}
                    className="landing-link"
                    data-strong
                  >
                    {featured.readLabel}
                    <ArrowRight aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="more-stories-heading"
          className="landing-section landing-inset stories-more"
        >
          <h2
            id="more-stories-heading"
            className="text-[1.5rem] font-medium tracking-tight"
          >
            More stories
          </h2>
          <ul className="stories-grid" role="list">
            {snapshot.stories.map((story) => (
              <li key={story.name}>
                <article className="stories-card">
                  <img
                    src={story.photo.src}
                    alt={story.photo.alt}
                    width={story.photo.width}
                    height={story.photo.height}
                    loading="lazy"
                    decoding="async"
                    className="stories-card-photo"
                  />
                  <div className="stories-card-text">
                    <p className="stories-card-role">{story.role}</p>
                    <p className="stories-card-quote">{story.quote}</p>
                    <Button
                      variant="ghost"
                      className="stories-card-name h-auto justify-start p-0 font-normal whitespace-normal"
                      aria-label={`Read story: ${story.name}`}
                      onClick={() => openStory(story)}
                    >
                      {story.name}
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>

        <LandingClose />
      </main>
      <LandingFooter />

      <StoryDialog
        story={activeStory}
        open={dialogOpen}
        onOpenChange={(open) => dispatch({ type: "open_changed", open })}
      />
    </div>
  )
}
