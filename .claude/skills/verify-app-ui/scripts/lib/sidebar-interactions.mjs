export const MIN_TARGET = 44
const VISIBLE_FILL = 4

export const itemsOf = (sidebar) =>
  `[...document.querySelector(${JSON.stringify(sidebar)}).querySelectorAll('a, button')].filter((e) => e.offsetParent)`

const itemStyles = (page, sidebar) =>
  page.evaluate(`(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgb = (css, under) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = under;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const under = getComputedStyle(document.querySelector(${JSON.stringify(sidebar)})).backgroundColor;
    return ${itemsOf(sidebar)}.map((e) => {
      const style = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return {
        name: e.getAttribute('aria-label') ?? e.textContent.trim(),
        current: e.getAttribute('aria-current') === 'page',
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        fill: rgb(style.backgroundColor, under),
        shadow: style.boxShadow,
        border: style.borderTopColor,
        focusVisible: e.matches(':focus-visible'),
      };
    });
  })()`)

export async function checkInteractions(page, tag, check, sidebar) {
  check(
    await page.evaluate(`matchMedia('(hover: hover)').matches`),
    `${tag} the browser reports hover support`
  )
  const rest = await itemStyles(page, sidebar)
  for (const [index, item] of rest.entries()) {
    await page.hover(item.x, item.y)
    await page.sleep(260)
    const now = (await itemStyles(page, sidebar))[index]
    await page.hover(720, 450)
    if (item.current) continue
    const delta = Math.max(
      ...item.fill.map((c, i) => Math.abs(c - now.fill[i]))
    )
    check(
      delta >= VISIBLE_FILL,
      `${tag} hover on "${item.name}" shows a visible fill (change ${delta}, ${item.fill} to ${now.fill})`
    )
  }
  await page.evaluate(`document.activeElement?.blur()`)
  await page.key("Tab")
  await page.evaluate(`${itemsOf(sidebar)}[0].focus()`)
  for (const item of rest) {
    await page.sleep(260)
    const focused = await page.evaluate(
      `(() => { const e = document.activeElement; return { name: e.getAttribute('aria-label') ?? e.textContent.trim(), visible: e.matches(':focus-visible'), shadow: getComputedStyle(e).boxShadow }; })()`
    )
    check(
      focused.name === item.name && focused.visible,
      `${tag} Tab reaches "${item.name}" with focus-visible (${focused.name})`
    )
    check(
      focused.shadow !== item.shadow && focused.shadow.includes("3px"),
      `${tag} focus-visible on "${item.name}" draws the kit ring (${focused.shadow})`
    )
    await page.key("Tab")
  }
}
