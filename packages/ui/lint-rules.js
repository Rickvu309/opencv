export const UNOWNED_TIMERS = [
  "ExpressionStatement > CallExpression[callee.name=/^(setTimeout|setInterval)$/]",
  "ExpressionStatement > CallExpression[callee.property.name=/^(setTimeout|setInterval)$/][callee.object.name=/^(window|globalThis)$/]",
  "ArrowFunctionExpression[body.callee.name=/^(setTimeout|setInterval)$/]",
  "ArrowFunctionExpression[body.callee.property.name=/^(setTimeout|setInterval)$/][body.callee.object.name=/^(window|globalThis)$/]",
].map((selector) => ({
  selector,
  message:
    "A timer whose handle is thrown away cannot be cleared, so it fires after unmount or after a test ends. Store the handle (const timer = window.setTimeout(...)) and clear it in the cleanup.",
}))

const ACTION_ATTRIBUTES =
  "JSXAttribute[name.name=/^(onClick|onSelect|href|render|asChild|form|disabled)$/], JSXAttribute[name.name='type'][value.value='submit'], JSXSpreadAttribute"

export const DEAD_CONTROLS = [
  `JSXOpeningElement[name.name=/^(Button|DropdownMenuItem|MenuItem)$/]:not(:has(${ACTION_ATTRIBUTES})):not(JSXAttribute[name.name='render'] *):not(JSXElement[openingElement.name.name=/Trigger$/] > JSXElement > JSXOpeningElement)`,
].map((selector) => ({
  selector,
  message:
    'This control has no action, so clicking it does nothing. Give it onClick, onSelect, type="submit", href, render or form, or remove it until the action exists.',
}))

export const DEAD_AND_UNOWNED = [...DEAD_CONTROLS, ...UNOWNED_TIMERS]
