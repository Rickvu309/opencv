import type { Attachment } from "./coach-workspace.reducer.ts"

export const LINK_LABEL_MAX = 120

export type AttachmentView = {
  key: string
  kind: Attachment["kind"]
  label: string
  title: string
  href: string | null
  external: boolean
}

const KIND_NAME = {
  paper: "Paper",
  job: "Job",
  link: "Link",
  file: "File",
} as const satisfies Record<Attachment["kind"], string>

export function linkAttachmentLabel(url: URL) {
  const host = url.hostname.replace(/^www\./, "")
  const rest = `${url.pathname}${url.search}`.replace(/\/$/, "")
  const label = `${host}${rest}`
  return label.length > LINK_LABEL_MAX
    ? `${label.slice(0, LINK_LABEL_MAX - 1)}…`
    : label
}

export function attachmentView(item: Attachment): AttachmentView {
  const href =
    item.kind === "paper"
      ? `/paper/${item.id}`
      : item.kind === "job"
        ? `/apply/${item.id}`
        : item.kind === "link"
          ? item.id
          : null
  return {
    key: `${item.kind}:${item.id}`,
    kind: item.kind,
    label: item.label,
    title: `${KIND_NAME[item.kind]}: ${item.kind === "link" ? item.id : item.label}`,
    href,
    external: item.kind === "link",
  }
}
