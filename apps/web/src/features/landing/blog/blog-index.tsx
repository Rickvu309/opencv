import { Link } from "@tanstack/react-router"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { LandingFooter } from "../landing-footer.tsx"
import { LandingNav } from "../landing-nav.tsx"
import "../landing.css"
import { BlogAuthor } from "./blog-author.tsx"
import { BlogCoverArt } from "./blog-covers.tsx"
import {
  BLOG_DESCRIPTION,
  BLOG_POSTS,
  BLOG_TITLE,
  type BlogPost,
  formatBlogDate,
  readLabel,
} from "./blog-copy.ts"
import "./blog.css"

function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <section className="blog-featured" aria-label="Featured post">
      <article>
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className={cn("blog-featured-link", FOCUS_RING)}
        >
          <div className="blog-featured-cover">
            <div className="blog-cover">
              <BlogCoverArt cover={post.cover} decorative />
            </div>
          </div>
          <div className="blog-featured-copy">
            <p className="blog-kicker">{post.category}</p>
            <h2 className="blog-featured-title">{post.title}</h2>
            <p className="blog-featured-dek">{post.dek}</p>
            <p className="blog-meta">
              <BlogAuthor />
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              <span>{readLabel(post.body)}</span>
            </p>
          </div>
        </Link>
      </article>
    </section>
  )
}

function PostRow({ post }: { post: BlogPost }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className={cn("blog-row", FOCUS_RING)}
    >
      <time className="blog-row-date" dateTime={post.date}>
        {formatBlogDate(post.date)}
      </time>
      <span className="blog-row-copy">
        <h3 className="blog-row-title">{post.title}</h3>
        <span className="blog-row-dek">{post.dek}</span>
      </span>
      <span className="blog-row-read">{readLabel(post.body)}</span>
    </Link>
  )
}

export function BlogIndexPage() {
  const [featured, ...rest] = BLOG_POSTS
  if (!featured) return null

  return (
    <div className="landing-root min-h-svh">
      <title>{BLOG_TITLE}</title>
      <meta name="description" content={BLOG_DESCRIPTION} />
      <LandingNav />
      <main className="landing-grid">
        <div className="landing-inset blog-page">
          <header className="blog-header">
            <h1 className="landing-section-title">Blog</h1>
            <p className="landing-section-body">{BLOG_DESCRIPTION}</p>
          </header>
        </div>
        <FeaturedPost post={featured} />
        <div className="landing-inset blog-page">
          <section className="blog-list-section" aria-labelledby="all-posts">
            <h2 id="all-posts" className="blog-list-title">
              All posts
            </h2>
            <ul className="blog-list">
              {rest.map((post) => (
                <li key={post.slug}>
                  <PostRow post={post} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
