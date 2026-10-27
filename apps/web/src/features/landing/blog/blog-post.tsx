import { Link, notFound, useParams } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { FOCUS_RING } from "@workspace/ui/lib/focus-ring"
import { cn } from "@workspace/ui/lib/utils"

import { LandingFooter } from "../landing-footer.tsx"
import { LandingNav } from "../landing-nav.tsx"
import "../landing.css"
import { BlogAuthor } from "./blog-author.tsx"
import { BlogCoverArt } from "./blog-covers.tsx"
import {
  type BlogBlock,
  type BlogPost,
  blogPostTitle,
  findBlogPost,
  formatBlogDate,
  morePosts,
  readLabel,
} from "./blog-copy.ts"
import "./blog.css"

function BlogBody({ body }: { body: readonly BlogBlock[] }) {
  return (
    <div className="blog-body">
      {body.map((block, index) => {
        if (block.kind === "h2") {
          return <h2 key={`${block.kind}-${index}`}>{block.text}</h2>
        }
        if (block.kind === "quote") {
          return (
            <blockquote key={`${block.kind}-${index}`} className="blog-pull">
              <p>{block.text}</p>
            </blockquote>
          )
        }
        return <p key={`${block.kind}-${index}`}>{block.text}</p>
      })}
    </div>
  )
}

function KeepReading({ post }: { post: BlogPost }) {
  const others = morePosts(post.slug)
  return (
    <section className="blog-more" aria-labelledby="keep-reading">
      <div className="blog-more-head">
        <h2 id="keep-reading" className="blog-more-title">
          Keep reading
        </h2>
        <Link to="/blog" data-strong className={cn("landing-link", FOCUS_RING)}>
          All posts
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <div className="blog-more-grid">
        {others.map((item) => (
          <Link
            key={item.slug}
            to="/blog/$slug"
            params={{ slug: item.slug }}
            className={cn("blog-more-card", FOCUS_RING)}
          >
            <time className="blog-more-date" dateTime={item.date}>
              {formatBlogDate(item.date)}
            </time>
            <h3 className="blog-more-card-title">{item.title}</h3>
            <p className="blog-more-card-dek">{item.moreDek ?? item.dek}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function BlogArticle({ post }: { post: BlogPost }) {
  return (
    <div className="landing-root min-h-svh">
      <title>{blogPostTitle(post.title)}</title>
      <meta name="description" content={post.dek} />
      <LandingNav />
      <main className="landing-grid">
        <div className="landing-inset blog-page">
          <article className="blog-article">
            <Link
              to="/blog"
              className={cn("landing-link blog-back", FOCUS_RING)}
            >
              <ArrowLeft aria-hidden="true" />
              Blog
            </Link>
            <p className="blog-kicker">{post.category}</p>
            <h1 className="blog-post-title">{post.title}</h1>
            <p className="blog-post-dek">{post.subtitle ?? post.dek}</p>
            <p className="blog-meta" data-large>
              <BlogAuthor />
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              <span>{readLabel(post.body)}</span>
            </p>
            <div className="blog-cover" data-compact>
              <BlogCoverArt cover={post.cover} />
            </div>
            <BlogBody body={post.body} />
          </article>
          <KeepReading post={post} />
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}

export function BlogPostPage() {
  const { slug } = useParams({ strict: false }) as { slug?: string }
  const post = slug ? findBlogPost(slug) : undefined
  if (!post) throw notFound()
  return <BlogArticle post={post} />
}
