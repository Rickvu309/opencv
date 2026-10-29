import { OpenCvLogo } from "@/components/app-logo.tsx"

import { BLOG_AUTHOR } from "./blog-copy.ts"

export function BlogAuthor() {
  return (
    <span className="blog-author">
      <span aria-hidden="true">
        <OpenCvLogo size="sm" />
      </span>
      {BLOG_AUTHOR}
    </span>
  )
}
