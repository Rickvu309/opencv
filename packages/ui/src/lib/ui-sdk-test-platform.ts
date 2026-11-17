declare global {
  var __UI_SDK_STRICT__: boolean | undefined
}

function isVisible(element: Element): boolean {
  const style = getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden") return false
  return element.parentElement ? isVisible(element.parentElement) : true
}

export function installUiSdkTestPlatform() {
  globalThis.__UI_SDK_STRICT__ = true
  HTMLElement.prototype.showPopover = function () {
    this.setAttribute("data-test-popover-open", "")
  }
  HTMLElement.prototype.hidePopover = function () {
    this.removeAttribute("data-test-popover-open")
  }
  Element.prototype.getAnimations = () => []
  Element.prototype.checkVisibility = function () {
    return isVisible(this)
  }
  document.elementFromPoint = () => null
  document.elementsFromPoint = () => []
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent:
        "[popover] { display: none !important } [popover][data-test-popover-open] { display: block !important }",
    })
  )
}
