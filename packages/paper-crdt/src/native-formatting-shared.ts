import {
  ok,
  refuse,
  type Result,
} from "@workspace/domain/internal/paper-presentation"

export const formattingFragmentName = (kind: "cv" | "letter") =>
  kind === "cv" ? "private-native-cv-v4-r2" : "document-store"

export function attempt<T>(work: () => T): Result<T> {
  try {
    return ok(work())
  } catch (error) {
    return refuse(error instanceof Error ? error.message : "Formatting refused")
  }
}
