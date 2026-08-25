import {
  PAPER_COMMANDS,
  type PaperContentKind,
  type PaperCreateDocInput,
  type PaperDoc,
  type PaperDocStatus,
} from "@workspace/domain"

import { apiFetch } from "@/lib/api.ts"

export const paperQueryKeys = {
  all: ["paper"] as const,
  list: () => ["paper", "list"] as const,
  detail: (id: string) => ["paper", "detail", id] as const,
}

type SuccessBody<T> = {
  ok: true
  data: T
}

function unwrapData<T>(body: SuccessBody<T>): T {
  return body.data
}

async function runCommand<T>(name: string, input: unknown): Promise<T> {
  const body = await apiFetch<SuccessBody<T>>(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return unwrapData(body)
}

export async function listPaperDocs(): Promise<PaperDoc[]> {
  const body = await apiFetch<SuccessBody<PaperDoc[]>>("/api/paper")
  return unwrapData(body)
}

export async function getPaperDoc(id: string): Promise<PaperDoc> {
  const body = await apiFetch<SuccessBody<PaperDoc>>(`/api/paper/${id}`)
  return unwrapData(body)
}

export function createPaperDoc(input: PaperCreateDocInput): Promise<PaperDoc> {
  return runCommand<PaperDoc>(PAPER_COMMANDS.createDoc, input)
}

export function updatePaperContent(input: {
  docId: string
  content: unknown
  contentVersion: number
}): Promise<PaperDoc> {
  return runCommand<PaperDoc>(PAPER_COMMANDS.updateContent, input)
}

export function renamePaperDoc(input: {
  docId: string
  name: string
}): Promise<PaperDoc> {
  return runCommand<PaperDoc>(PAPER_COMMANDS.renameDoc, input)
}

export function setPaperDocStatus(input: {
  docId: string
  status: PaperDocStatus
}): Promise<PaperDoc> {
  return runCommand<PaperDoc>(PAPER_COMMANDS.setStatus, input)
}

export function deletePaperDoc(input: {
  docId: string
}): Promise<{ id: string }> {
  return runCommand<{ id: string }>(PAPER_COMMANDS.deleteDoc, input)
}

export function linkPaperApplyCard(input: {
  docId: string
  applyCardId: string | null
}): Promise<PaperDoc> {
  return runCommand<PaperDoc>(PAPER_COMMANDS.linkApplyCard, input)
}

export function upsertPaperDoc(docs: PaperDoc[], next: PaperDoc): PaperDoc[] {
  return [next, ...docs.filter((doc) => doc.id !== next.id)]
}

export function createKindLabel(kind: PaperContentKind) {
  return kind === "cv" ? "CV" : kind === "letter" ? "Letter" : "Proof"
}
