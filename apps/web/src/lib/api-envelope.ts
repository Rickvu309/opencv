import { apiFetch } from "@/lib/api.ts"

export type SuccessBody<T> = {
  ok: true
  data: T
}

export function unwrapData<T>(body: SuccessBody<T>): T {
  return body.data
}

export async function runCommand<T>(name: string, input: unknown): Promise<T> {
  const body = await apiFetch<SuccessBody<T>>(`/api/commands/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return unwrapData(body)
}
