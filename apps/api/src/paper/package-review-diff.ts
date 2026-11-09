import { paperReviewDiff, type PaperReviewDiff } from "@workspace/domain"

export type { PaperReviewDiff, PaperReviewReplacement } from "@workspace/domain"

export function packageReviewDiff(review: unknown): PaperReviewDiff {
  return paperReviewDiff(review)
}
