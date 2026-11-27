import type { BlockId, DocCommand } from "@workspace/domain/paper-doc"

import { bindToolInput } from "./input-port.ts"
import { placePopover, toolButton } from "./tool-elements.ts"

type Photo = {
  block: BlockId
  x: number
  y: number
  w: number
  h: number
  widthMpt: number
  heightMpt: number
  maxWidthMpt: number
}

const corners = [
  ["top left", -1, -1],
  ["top right", 1, -1],
  ["bottom left", -1, 1],
  ["bottom right", 1, 1],
] as const

export function createPhotoHandles(
  host: HTMLElement,
  resize: (block: BlockId, widthMpt: number, heightMpt: number) => void,
  focus: () => void
) {
  const frame = document.createElement("div")
  frame.className = "paper-photo-handles"
  frame.setAttribute("role", "group")
  frame.setAttribute("aria-label", "Photo resize")
  frame.hidden = true
  host.append(frame)
  let photo: Photo | null = null

  function position(picture: Photo, widthMpt: number, xDir = 1, yDir = 1) {
    const factor = widthMpt / picture.widthMpt
    const w = picture.w * factor
    const h = picture.h * factor
    frame.style.left = `${picture.x + (xDir < 0 ? picture.w - w : 0)}px`
    frame.style.top = `${picture.y + (yDir < 0 ? picture.h - h : 0)}px`
    frame.style.width = `${w}px`
    frame.style.height = `${h}px`
  }

  function width(picture: Photo, deltaMpt: number) {
    const min = Math.min(picture.widthMpt, 12000)
    return Math.max(
      min,
      Math.min(
        Math.max(min, picture.maxWidthMpt),
        Math.round(picture.widthMpt + deltaMpt)
      )
    )
  }

  function commit(picture: Photo, value: number) {
    if (value !== picture.widthMpt)
      resize(
        picture.block,
        value,
        Math.max(1, Math.round((value * picture.heightMpt) / picture.widthMpt))
      )
    focus()
  }

  for (const [name, xDir, yDir] of corners) {
    const handle = document.createElement("button")
    handle.type = "button"
    handle.className = "paper-photo-handle"
    handle.dataset.corner = name.replace(" ", "-")
    handle.setAttribute("aria-label", `Resize photo ${name}`)
    frame.append(handle)
    let drag: {
      pointer: number
      x: number
      y: number
      photo: Photo
      width: number
    } | null = null

    handle.addEventListener("pointerdown", (event) => {
      if (!photo || event.button !== 0 || !event.isPrimary) return
      event.preventDefault()
      handle.setPointerCapture(event.pointerId)
      drag = {
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        photo,
        width: photo.widthMpt,
      }
    })
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointer !== event.pointerId) return
      const { photo: picture } = drag
      const dx = (event.clientX - drag.x) * xDir
      const dy = (event.clientY - drag.y) * yDir
      const delta =
        (dx * picture.w + dy * picture.h) / (picture.w ** 2 + picture.h ** 2)
      drag.width = width(picture, delta * picture.widthMpt)
      position(picture, drag.width, xDir, yDir)
    })
    handle.addEventListener("pointerup", (event) => {
      if (!drag || drag.pointer !== event.pointerId) return
      const finished = drag
      drag = null
      position(finished.photo, finished.photo.widthMpt)
      commit(finished.photo, finished.width)
    })
    function cancel(event: PointerEvent) {
      if (!drag || drag.pointer !== event.pointerId) return
      position(drag.photo, drag.photo.widthMpt)
      drag = null
    }
    handle.addEventListener("pointercancel", cancel)
    handle.addEventListener("lostpointercapture", cancel)
    bindToolInput(handle, (event) => {
      if (event.key === "Escape") focus()
      if (!photo) return
      const dirs: Record<string, number> = {
        ArrowLeft: -xDir,
        ArrowRight: xDir,
        ArrowUp: -yDir,
        ArrowDown: yDir,
      }
      const dir = dirs[event.key]
      if (!dir) return
      event.preventDefault()
      const next = width(photo, dir * (event.shiftKey ? 12000 : 3000))
      if (next !== photo.widthMpt)
        resize(
          photo.block,
          next,
          Math.max(1, Math.round((next * photo.heightMpt) / photo.widthMpt))
        )
    })
  }

  return {
    update(next: Photo | null) {
      photo = next
      if (frame.hidden !== !next) frame.hidden = !next
      if (next) position(next, next.widthMpt)
    },
    destroy: () => frame.remove(),
  }
}

type TableEdit = Extract<DocCommand, { op: "editTable" }>["action"]

const tableActions = [
  ["Add row", "rowBelow"],
  ["Delete row", "deleteRow"],
  ["Add column", "colRight"],
  ["Delete column", "deleteCol"],
  ["Delete table", "deleteTable"],
] as const satisfies readonly (readonly [string, TableEdit])[]

export function createTableTools(
  host: HTMLElement,
  edit: (operation: TableEdit) => void,
  focus: () => void
) {
  const tools = document.createElement("div")
  tools.className = "paper-tools paper-table-tools"
  tools.setAttribute("role", "group")
  tools.setAttribute("aria-label", "Table")
  tools.hidden = true
  for (const [label, operation] of tableActions)
    tools.append(toolButton(label, () => edit(operation)))
  host.append(tools)
  bindToolInput(tools, (event) => {
    if (event.key === "Escape") focus()
  })

  return {
    update(position: { x: number; y: number } | null) {
      if (tools.hidden !== !position) tools.hidden = !position
      if (position) placePopover(tools, position.x, position.y, 476)
    },
    destroy: () => tools.remove(),
  }
}
