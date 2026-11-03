const TIMER_CALL =
  "CallExpression:matches([callee.name=/^(setTimeout|setInterval)$/], [callee.property.name=/^(setTimeout|setInterval)$/][callee.object.name=/^(window|globalThis|self)$/])"

export const UNOWNED_TIMERS = [
  `${TIMER_CALL}:not(VariableDeclarator > CallExpression, AssignmentExpression > CallExpression, ReturnStatement > CallExpression)`,
].map((selector) => ({
  selector,
  message:
    "A timer whose handle is thrown away cannot be cleared, so it fires after unmount or after a test ends. Store the handle (const timer = window.setTimeout(...)) and clear it in the cleanup.",
}))

const ACTION_ATTRIBUTES =
  "JSXAttribute[name.name=/^(onClick|onSelect|href|render|asChild|form)$/], JSXAttribute[name.name='disabled'][value=null], JSXAttribute[name.name='disabled'][value.expression.value=true], JSXAttribute[name.name='type'][value.value='submit'], JSXSpreadAttribute"

export const DEAD_CONTROLS = [
  `JSXOpeningElement[name.name=/^(Button|DropdownMenuItem|MenuItem)$/]:not(:has(${ACTION_ATTRIBUTES})):not(JSXAttribute[name.name='render'] *):not(JSXElement[openingElement.name.name=/Trigger$/] > JSXElement > JSXOpeningElement)`,
].map((selector) => ({
  selector,
  message:
    'This control has no action, so clicking it does nothing. Give it onClick, onSelect, type="submit", href, render or form, or remove it until the action exists.',
}))

export const EXTERNAL_OPENS = [
  {
    selector:
      "CallExpression[callee.object.name=/^(window|globalThis)$/][callee.property.name='open'][arguments.2.value=/noopener/]",
    message:
      'window.open with "noopener" in its features returns null even when the tab opened, so the page reports a blocked tab. Render a real <a href target="_blank" rel="noopener noreferrer"> instead.',
  },
  {
    selector:
      "JSXOpeningElement[name.name='a']:has(JSXAttribute[name.name='target'][value.value='_blank']):not(:has(JSXAttribute[name.name='rel'][value.value=/noopener|noreferrer/])):not(:has(JSXSpreadAttribute))",
    message:
      'A link that opens a new tab must carry rel="noopener noreferrer", or the opened page can reach window.opener.',
  },
]

export const DEAD_AND_UNOWNED = [
  ...DEAD_CONTROLS,
  ...UNOWNED_TIMERS,
  ...EXTERNAL_OPENS,
]
