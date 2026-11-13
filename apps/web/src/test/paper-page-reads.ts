import { act, waitFor } from "@testing-library/react"
import { expect } from "vitest"

function everyStepAlreadyQueued() {
  return new Promise<void>((resolve) => setImmediate(resolve))
}

export async function expectNoReadFrom(
  cause: () => void,
  reads: () => number,
  readsOnceSettled: number
) {
  await waitFor(() => expect(reads()).toBe(readsOnceSettled))
  await act(everyStepAlreadyQueued)
  expect(reads()).toBe(readsOnceSettled)
  cause()
  await act(everyStepAlreadyQueued)
  expect(reads()).toBe(readsOnceSettled)
}
