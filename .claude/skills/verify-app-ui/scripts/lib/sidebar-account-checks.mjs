export async function accountMenu({ page, check, capture, tag }) {
  await page.evaluate(
    `document.querySelector('[data-slot="account-trigger"]').click()`
  )
  await page.waitFor(`document.querySelector('[role="menu"]')`, 5000)
  await page.sleep(400)
  const menu = await page.evaluate(`(() => {
    const t = document.querySelector('[data-slot="account-trigger"]').getBoundingClientRect();
    const m = document.querySelector('[role="menu"]');
    const r = m.getBoundingClientRect();
    return { trigger: { x: t.left, y: t.top, w: t.width }, menu: { x: r.left, b: r.bottom, w: r.width }, items: [...m.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent.trim()), text: m.textContent, separators: m.querySelectorAll('[role="separator"]').length, rowName: (() => { const n = getComputedStyle(document.querySelector('[data-slot="account-name"]')); return { size: parseFloat(n.fontSize), color: n.color }; })(), rowEmail: (() => { const n = getComputedStyle(document.querySelector('[data-slot="account-email"]')); return { size: parseFloat(n.fontSize), color: n.color }; })(), navColor: getComputedStyle(document.querySelector('[data-slot="sidebar-link"]')).color, itemIconX: Math.round(m.querySelector('[role="menuitem"] svg').getBoundingClientRect().left), avatarX: Math.round(document.querySelector('[data-slot="account-trigger"] [data-slot="avatar"]').getBoundingClientRect().left) };
  })()`)
  check(
    menu.menu.b <= menu.trigger.y + 1 &&
      Math.abs(menu.menu.x - (menu.trigger.x - 4)) <= 1 &&
      Math.abs(menu.menu.w - menu.trigger.w) <= 2,
    `${tag} the account menu opens upward at the row width, 4px out so its items line up with the row (menu ${menu.menu.x}/${menu.menu.w}, row ${menu.trigger.x}/${menu.trigger.w})`
  )
  check(
    menu.items.join("|") === "Settings|Sign out" &&
      !menu.text.includes("Linh Nguyen") &&
      menu.text.includes("@") &&
      menu.separators === 1,
    `${tag} the account menu shows only the email as its header, Settings, one divider and Sign out (${menu.items.join("|")}, ${menu.separators} divider)`
  )
  check(
    menu.rowEmail.size < menu.rowName.size &&
      menu.rowEmail.color !== menu.rowName.color &&
      menu.rowEmail.color !== menu.navColor &&
      menu.itemIconX === menu.avatarX,
    `${tag} the row email is smaller and lighter than the name and the nav, and the menu icons align with the avatar (email ${menu.rowEmail.size}px ${menu.rowEmail.color}, nav ${menu.navColor}, icon x ${menu.itemIconX}, avatar x ${menu.avatarX})`
  )
  await page.hover(900, 200)
  await capture(page, "sidebar-account-menu.png", {
    x: 0,
    y: 500,
    width: 520,
    height: 400,
  })
  await page.key("Escape")
  await page.sleep(300)
  check(
    await page.evaluate(
      `!document.querySelector('[role="menu"]') && document.activeElement === document.querySelector('[data-slot="account-trigger"]')`
    ),
    `${tag} Escape closes the account menu and returns focus to the row`
  )
}
