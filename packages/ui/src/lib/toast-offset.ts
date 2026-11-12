export const TOAST_OFFSET_BOTTOM = "--toast-offset-bottom"
export const TOAST_OFFSET_RIGHT = "--toast-offset-right"
export const TOAST_MAX_WIDTH = "--toast-max-width"

export const TOAST_CORNER_PX = 24
export const TOAST_CORNER_ON_PHONES_PX = 16
export const TOAST_PHONE_MAX_WIDTH_PX = 600
export const TOAST_WIDTH_PX = 356

const pxVar = (name: string) => (fallbackPx: number) =>
  `var(${name}, ${fallbackPx}px)`

export const toastOffsetBottom = pxVar(TOAST_OFFSET_BOTTOM)
export const toastOffsetRight = pxVar(TOAST_OFFSET_RIGHT)
export const toastMaxWidth = pxVar(TOAST_MAX_WIDTH)
