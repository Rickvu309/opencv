import type { Profile, ProfileUpdateInput } from "@workspace/domain"

import { unwrapData, type SuccessBody } from "@/lib/api-envelope.ts"
import { ApiError } from "@/lib/api.ts"
import { endpoints, fetchBinary } from "@/lib/requests.ts"

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024
export const PHOTO_REJECTION = "Choose an image under 2 MB."
export const EMAIL_REJECTION = "Use a full email, like name@example.com."
export const NAME_REJECTION = "Enter your name."
export const TIME_ZONE_REJECTION = "Use a time zone like Asia/Ho_Chi_Minh."
export const EXPORT_FILENAME = "opencv-export.json"
export const GMAIL_UNAVAILABLE = "Gmail is not available in this build."
export const LOAD_ERROR = "Could not load settings."
export const NO_WEEKLY_CAP = "No weekly cap on this mode."
export const NO_SESSION_CAP = "No session cap on this mode."

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SettingsSave = {
  pending: boolean
  errorKey?: string
  error?: string
  onSave: (patch: ProfileUpdateInput) => void
}

export function photoRejection(file: File) {
  if (!file.type.startsWith("image/")) return PHOTO_REJECTION
  if (file.size > PHOTO_MAX_BYTES) return PHOTO_REJECTION
  return null
}

export function emailRejection(value: string) {
  return EMAIL_PATTERN.test(value.trim()) ? null : EMAIL_REJECTION
}

export function filenameFromDisposition(header: string | null) {
  const match = header?.match(/filename="([^"]+)"/)
  return match?.[1] || EXPORT_FILENAME
}

export function sessionResetLabel(resetsAt: string) {
  const minutes = Math.max(
    0,
    Math.round((new Date(resetsAt).getTime() - Date.now()) / 60000)
  )
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `Resets in ${hours} hr ${minutes % 60} min`
  }
  return `Resets in ${minutes} min`
}

export function weekResetLabel(resetsAt: string, timeZone: string) {
  const date = new Date(resetsAt)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? ""
  const hour = parts.find((part) => part.type === "hour")?.value ?? ""
  const minute = parts.find((part) => part.type === "minute")?.value ?? ""
  if (weekday === "Monday" && hour === "07" && minute === "00") {
    return "Resets Monday at 7:00"
  }
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
  return `Resets ${weekday} at ${time}`
}

export function percentLabel(percent: number) {
  return `${percent}% used`
}

export function weekUsageLabel(percent: number) {
  return `${percent}% of this week used`
}

export async function uploadPhoto(file: File) {
  const rejection = photoRejection(file)
  if (rejection) throw new ApiError(400, "VALIDATION_ERROR", rejection)
  const form = new FormData()
  form.set("file", file)
  const res = await fetchBinary(endpoints.accountPhoto, {
    method: "POST",
    body: form,
    credentials: "include",
  })
  if (!res.ok) {
    const message = await errorMessage(res)
    throw new ApiError(res.status, "REQUEST_FAILED", message)
  }
  const body = (await res.json()) as SuccessBody<Profile>
  return unwrapData(body)
}

export async function connectGmail() {
  const res = await fetchBinary(endpoints.inboxConnect, {
    credentials: "include",
  })
  if (res.status === 404) return { url: null as string | null }
  if (!res.ok) return { url: null as string | null }
  const body = (await res.json()) as {
    data?: { url?: string | null }
  }
  const url = body.data?.url
  return { url: typeof url === "string" && url.length > 0 ? url : null }
}

export async function downloadExport() {
  const res = await fetchBinary(endpoints.accountExport, {
    credentials: "include",
  })
  if (!res.ok) {
    const message = await errorMessage(res)
    throw new ApiError(res.status, "REQUEST_FAILED", message)
  }
  const filename = filenameFromDisposition(
    res.headers.get("content-disposition")
  )
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return filename
}

async function errorMessage(res: Response) {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
  return body?.error?.message ?? `Request failed with ${res.status}`
}

export function isPlanRequired(error: unknown) {
  return error instanceof ApiError && error.code === "PLAN_REQUIRED"
}
