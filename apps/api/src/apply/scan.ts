import {
  APPLY_SCAN_EMPTY,
  APPLY_SCAN_FETCH_FAILED,
  APPLY_SCAN_NOT_FOUND,
  APPLY_SCAN_UNAVAILABLE,
  ERROR_CODES,
  applyScanHasIdentity,
  applyScanInputSchema,
  coachProviderErrorMessage,
  extractApplyFieldsFromHiringText,
  extractApplyFieldsFromLabeledText,
  extractApplyFieldsFromMarkup,
  groundApplyScanResult,
  isUnreadableApplyPosting,
  mergeApplyScanResults,
  parseApplyScanInput,
  parseApplyScanModelText,
  postingTextFromHtml,
  type ApplyScanInput,
  type ApplyScanResult,
  type CoachRuntime,
} from "@workspace/domain"

import type { FetchJobPosting } from "./fetch-posting.js"

export const APPLY_SCAN_SOURCE_MAX = 12_000

export type ApplyScanOutcome =
  | { ok: true; data: ApplyScanResult }
  | { ok: false; code: string; message: string }

export async function scanApplyPosting({
  input,
  coach,
  fetchJobPosting,
}: {
  input: unknown
  coach?: CoachRuntime
  fetchJobPosting: FetchJobPosting
}): Promise<ApplyScanOutcome> {
  const parsedInput = applyScanInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_EMPTY,
    }
  }

  const parsed = parseApplyScanInput({
    jobUrl: parsedInput.data.jobUrl ?? "",
    jdText: parsedInput.data.jdText ?? "",
  })
  if (!parsed.ok) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: parsed.message,
    }
  }

  const source = await resolveScanSource({
    jobUrl: parsed.jobUrl,
    jdText: parsed.jdText,
    fetchJobPosting,
  })
  if (!source.ok) return source

  const labeled = groundApplyScanResult(
    source.text,
    extractApplyFieldsFromLabeledText(source.text)
  )
  const hiring = groundApplyScanResult(
    source.text,
    extractApplyFieldsFromHiringText(source.text)
  )
  const markup = groundApplyScanResult(
    source.text,
    extractApplyFieldsFromMarkup(source.raw)
  )
  const deterministic = mergeApplyScanResults(labeled, hiring, markup)
  const model = await extractWithModel(source.text, coach)
  if (!model.ok && !applyScanHasIdentity(deterministic)) return model

  const merged = mergeApplyScanResults(
    deterministic,
    model.ok ? model.data : { title: null, company: null, note: null }
  )
  if (!applyScanHasIdentity(merged)) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_NOT_FOUND,
    }
  }
  return { ok: true, data: merged }
}

async function resolveScanSource({
  jobUrl,
  jdText,
  fetchJobPosting,
}: {
  jobUrl: string | null
  jdText: string | null
  fetchJobPosting: FetchJobPosting
}): Promise<
  | { ok: true; raw: string; text: string }
  | { ok: false; code: string; message: string }
> {
  if (jdText) {
    return { ok: true, raw: jdText, text: jdText }
  }
  if (!jobUrl) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_EMPTY,
    }
  }

  const fetched = await fetchJobPosting(jobUrl)
  if (!fetched.ok) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: fetched.message || APPLY_SCAN_FETCH_FAILED,
    }
  }
  const text = postingTextFromHtml(fetched.text)
  if (!text || isUnreadableApplyPosting(text)) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_FETCH_FAILED,
    }
  }
  return { ok: true, raw: fetched.text, text }
}

async function extractWithModel(
  sourceText: string,
  coach?: CoachRuntime
): Promise<ApplyScanOutcome> {
  if (!coach?.scanJobPosting) {
    return {
      ok: false,
      code: ERROR_CODES.COACH_UNAVAILABLE,
      message: APPLY_SCAN_UNAVAILABLE,
    }
  }

  let raw: string
  try {
    raw = await coach.scanJobPosting({
      postingText: sourceText.slice(0, APPLY_SCAN_SOURCE_MAX),
    })
  } catch (error) {
    return {
      ok: false,
      code: ERROR_CODES.COACH_UNAVAILABLE,
      message: coachProviderErrorMessage(error, "free"),
    }
  }

  const grounded = groundApplyScanResult(
    sourceText,
    parseApplyScanModelText(raw)
  )
  if (!applyScanHasIdentity(grounded)) {
    return {
      ok: false,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: APPLY_SCAN_NOT_FOUND,
    }
  }
  return { ok: true, data: grounded }
}

export type { ApplyScanInput }
