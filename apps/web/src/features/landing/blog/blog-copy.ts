import { post as applyingIsB2bSales } from "./posts/applying-is-b2b-sales.ts"
import { post as showYourWork } from "./posts/show-your-work-not-your-duties.ts"
import { post as stopMassApplying } from "./posts/stop-mass-applying.ts"
import { post as tailorTheTopThird } from "./posts/tailor-the-top-third.ts"
import { post as followUp } from "./posts/the-follow-up-is-part-of-the-application.ts"
import { post as discoveryCalls } from "./posts/treat-interviews-like-discovery-calls.ts"
import { post as beActive } from "./posts/be-active-not-available.ts"

export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "quote"; text: string }

export type BlogCoverKey =
  | "b2b-sales"
  | "show-work"
  | "fewer-applications"
  | "top-third"
  | "follow-up"
  | "discovery"
  | "in-public"

export type BlogPost = {
  slug: string
  category: string
  title: string
  dek: string
  date: string
  cover: BlogCoverKey
  body: readonly BlogBlock[]
}

export const BLOG_AUTHOR = "The opencv team"

export const BLOG_TITLE = "opencv. Blog"

export const BLOG_DESCRIPTION =
  "Short notes on getting hired by showing your work."

const WORDS_PER_MINUTE = 200

export function readMinutes(body: readonly BlogBlock[]): number {
  const words = body.reduce((total, block) => {
    const trimmed = block.text.trim()
    if (trimmed === "") return total
    return total + trimmed.split(/\s+/).length
  }, 0)
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

export function readLabel(body: readonly BlogBlock[]): string {
  return `${readMinutes(body)} min read`
}

const blogDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export function formatBlogDate(isoDate: string): string {
  return blogDateFormat.format(new Date(`${isoDate}T00:00:00Z`))
}

export function blogPostTitle(title: string): string {
  return `opencv. ${title}`
}

export function morePosts(slug: string, count = 3): readonly BlogPost[] {
  const index = BLOG_POSTS.findIndex((post) => post.slug === slug)
  if (index < 0) return BLOG_POSTS.slice(0, count)
  return [...BLOG_POSTS.slice(index + 1), ...BLOG_POSTS.slice(0, index)].slice(
    0,
    count
  )
}

export function findBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

export const BLOG_POSTS: readonly BlogPost[] = [
  applyingIsB2bSales,
  showYourWork,
  stopMassApplying,
  tailorTheTopThird,
  followUp,
  discoveryCalls,
  beActive,
]
