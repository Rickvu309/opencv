import { NATIVE_WRITER, paperQueries, type PaperId } from "@workspace/domain"

import { apiFetch } from "./api.ts"
import { unwrapData, type SuccessBody } from "./api-envelope.ts"
import { queryKey } from "./contract-client.ts"
import { endpoints } from "./requests.ts"

const headers = { "x-paper-writer": JSON.stringify(NATIVE_WRITER) }

export const paperListKey = () =>
  queryKey({ query: "paper.list", input: { writer: NATIVE_WRITER } })
export const paperGetKey = (docId: PaperId) =>
  queryKey({ query: "paper.get", input: { docId, writer: NATIVE_WRITER } })
export const paperPagesKey = (docId: PaperId) =>
  queryKey({
    query: "paper.pageCount",
    input: { docId, writer: NATIVE_WRITER },
  })
export const paperSharedKey = (token: string) =>
  queryKey({ query: "paper.shared", input: { token, writer: NATIVE_WRITER } })

async function read(url: string): Promise<unknown> {
  return unwrapData(await apiFetch<SuccessBody<unknown>>(url, { headers }))
}

export async function listPaper() {
  return paperQueries["paper.list"].output.parse(await read(endpoints.paper))
}

export async function getPaper(docId: string) {
  return paperQueries["paper.get"].output.parse(
    await read(endpoints.paperDoc(docId))
  )
}

export async function getPaperPages(docId: string) {
  return paperQueries["paper.pageCount"].output.parse(
    await read(endpoints.paperPages(docId))
  )
}

export async function getSharedPaper(token: string) {
  return paperQueries["paper.shared"].output.parse(
    await read(endpoints.paperShared(token))
  )
}
