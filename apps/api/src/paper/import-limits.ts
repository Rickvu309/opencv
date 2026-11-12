export const IMPORT_READ_LIMITS = Object.freeze({
  pdfPages: 20,
  pdfStreams: 10_000,
  inflatedBytes: 32 * 1024 * 1024,
  itemsPerPage: 20_000,
  textChars: 200_000,
  workerHeapMb: 128,
  workerYoungMb: 16,
  workerStackMb: 4,
  workerMemoryBytes: 192 * 1024 * 1024,
  memoryCheckMs: 10,
  workers: 2,
  waiting: 12,
  waitMs: 75_000,
  accountBudgetMs: 60_000,
  accountWindowMs: 60 * 60_000,
  fairStepMs: 5_000,
  accountRetryMs: 10_000,
  serviceRetryMs: 60_000,
})

export const IMPORT_TEXT_LIMITS = Object.freeze({
  textFileBytes: 800_000,
  textChars: IMPORT_READ_LIMITS.textChars,
  lineChars: 50_000,
  contactLineChars: 300,
})
