export const TOAST_OFFSET_BOTTOM = "--toast-offset-bottom"
export const TOAST_OFFSET_RIGHT = "--toast-offset-right"

export const TOAST_CORNER_PX = 24
export const TOAST_CORNER_ON_PHONES_PX = 16
export const TOAST_PHONE_MAX_WIDTH_PX = 600

const offsetVar = (name: string) => (cornerPx: number) =>
  `var(${name}, ${cornerPx}px)`

export const toastOffsetBottom = offsetVar(TOAST_OFFSET_BOTTOM)
export const toastOffsetRight = offsetVar(TOAST_OFFSET_RIGHT)
