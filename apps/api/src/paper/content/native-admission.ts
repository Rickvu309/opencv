import { ERROR_CODES } from "@workspace/domain/kernel"
import {
  nativeAdmission,
  type NativeWriter,
  type StoredPaperDocument,
} from "@workspace/domain/paper-doc"

import { CommandError } from "../../platform/errors.js"

export function admitDocument(
  document: StoredPaperDocument,
  writer?: NativeWriter
) {
  const refusal = nativeAdmission(document, writer)
  if (refusal) throw new CommandError(ERROR_CODES.CONFLICT, refusal)
}
