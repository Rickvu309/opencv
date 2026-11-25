export function installEditorPolyfills() {
  ;(globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??=
    class extends Event {
      clipboardData = null
    }
  Element.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
}
