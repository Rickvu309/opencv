export type SuccessBody<T> = {
  ok: true
  data: T
}

export function unwrapData<T>(body: SuccessBody<T>): T {
  return body.data
}
