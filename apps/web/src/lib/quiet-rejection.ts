export const QUIET_REJECTIONS = {
  welcomeLanguagePostMayFail:
    "a failed language post still lets welcome finish",
  welcomeRetriesOnNextLoad: "the next signed-in load tries welcome again",
  stopAfterAbortIsHarmless:
    "the stream aborts either way, a missed stop is harmless",
  failedCreateLeavesPanelClosed:
    "a failed create leaves the panel closed and the page usable",
  cancelledImportCleanupStaysQuiet:
    "the person already cancelled the import, so a failed cleanup stays quiet",
  orphanPhotoDeleteShowsTheAttachError:
    "the attach error is the one to show, and this delete removes the orphan row",
  undoAlreadyLandedSoTheSweepRemovesTheRow:
    "the undo already saved the photo, so a failed delete waits for the sweep",
} as const

export type QuietRejectionKey = keyof typeof QUIET_REJECTIONS

export function ignoreRejection<T>(
  promise: PromiseLike<T>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the key is the reviewed reason; the scan reads the call, not the value
  _why: QuietRejectionKey
): Promise<T | undefined> {
  return Promise.resolve(promise).catch(() => undefined)
}
