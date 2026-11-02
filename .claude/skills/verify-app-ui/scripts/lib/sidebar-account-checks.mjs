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
      menu.itemIconX === menu.avatarX,
    `${tag} the row email is smaller and lighter than the name, and the menu icons align with the avatar (email ${menu.rowEmail.size}px ${menu.rowEmail.color}, nav ${menu.navColor}, icon x ${menu.itemIconX}, avatar x ${menu.avatarX})`
  )
  const details = await page.evaluate(`(() => {
    const m = document.querySelector('[role="menu"]');
    const items = [...m.querySelectorAll('[role="menuitem"]')];
    const color = (e) => getComputedStyle(e).color;
    const header = m.querySelector('[data-slot="account-menu-email"]');
    const signOut = items[1].getBoundingClientRect();
    return { header: color(header), headerSize: parseFloat(getComputedStyle(header).fontSize), row: color(document.querySelector('[data-slot="account-email"]')), settingsIcon: color(items[0].querySelector('svg')), signOutIcon: color(items[1].querySelector('svg')), signOutX: signOut.left + signOut.width / 2, signOutY: signOut.top + signOut.height / 2, text: color(items[1]) };
  })()`)
  check(
    details.header === details.row && details.headerSize === 12,
    `${tag} the email is one grey and size in the row and the menu header (row ${details.row}, menu ${details.header} ${details.headerSize}px)`
  )
  await page.hover(details.signOutX, details.signOutY)
  await page.sleep(200)
  const hovered = await page.evaluate(
    `getComputedStyle([...document.querySelectorAll('[role="menuitem"]')][1]).color`
  )
  const settingsIcon = await page.evaluate(
    `getComputedStyle([...document.querySelectorAll('[role="menuitem"]')][0].querySelector('svg')).color`
  )
  check(
    settingsIcon === details.signOutIcon,
    `${tag} the Settings and Sign out icons rest in one colour (${settingsIcon} / ${details.signOutIcon})`
  )
  check(
    hovered === details.text,
    `${tag} Sign out stays neutral on hover instead of turning red (${details.text} then ${hovered})`
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

export async function phoneAccountMenu({ phone, check }) {
  await phone.evaluate(
    `document.querySelector('[role="dialog"] [data-slot="account-trigger"]').click()`
  )
  await phone.waitFor(`document.querySelector('[role="menu"]')`, 5000)
  await phone.sleep(400)
  const m = await phone.evaluate(`(() => {
    const menu = document.querySelector('[role="menu"]');
    const row = document.querySelector('[role="dialog"] [data-slot="account-trigger"]').getBoundingClientRect();
    return { menuX: Math.round(menu.getBoundingClientRect().left), cls: menu.className.includes('max-md:-translate-x-2'), tr: getComputedStyle(menu).translate, rowX: Math.round(row.left), icon: Math.round(menu.querySelector('[role="menuitem"] svg').getBoundingClientRect().left), avatar: Math.round(document.querySelector('[role="dialog"] [data-slot="account-trigger"] [data-slot="avatar"]').getBoundingClientRect().left) };
  })()`)
  check(
    m.icon === m.avatar,
    `390 the account menu icons line up with the avatar (icon x ${m.icon}, avatar x ${m.avatar}, menu x ${m.menuX}, row x ${m.rowX}, ${m.cls} ${m.tr})`
  )
  await phone.key("Escape")
  await phone.sleep(300)
}
