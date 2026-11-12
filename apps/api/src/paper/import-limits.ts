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
  parallel: 1,
  waiting: 9,
  waitMs: 20_000,
})

export const IMPORT_TEXT_LIMITS = Object.freeze({
  textFileBytes: 800_000,
  textChars: IMPORT_READ_LIMITS.textChars,
  lineChars: 50_000,
  contactLineChars: 300,
})
