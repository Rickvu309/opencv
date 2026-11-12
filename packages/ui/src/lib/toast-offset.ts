export const TOAST_OFFSET_BOTTOM = "--toast-offset-bottom"

export const toastOffsetBottom = (cornerPx: number) =>
  `var(${TOAST_OFFSET_BOTTOM}, ${cornerPx}px)`
