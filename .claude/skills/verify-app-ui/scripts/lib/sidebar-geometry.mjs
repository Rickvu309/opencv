export const BOX = 0.5
export const PEN = {
  search: { x: 174, y: 14 },
  newChat: { x: 204, y: 14 },
  rows: {
    Inbox: 54,
    Coach: 83,
    Jobs: 112,
    Paper: 181,
    Apply: 210,
    Pitch: 239,
    "Junior Marketing CV": 308,
    "Lumière application Lumière": 337,
  },
  labels: { "Your work": 152, Favorites: 279 },
  rowRadius: 6,
  newChatRadius: 14,
  panel: { x: 244, y: 8, rightInset: 8, radius: 8 },
  labelPaddingLeft: 8,
  iconInset: 6,
  chevronInset: 9.5,
  footer: { height: 40, avatar: 24 },
}

export const ACTIVE_BACKGROUND = "rgb(225, 225, 226)"

export const geometry = (page, sidebar) =>
  page.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(sidebar)});
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right }; };
    const one = (selector) => root.querySelector(selector);
    const radius = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius);
    const links = [...root.querySelectorAll('[data-slot="sidebar-link"]')].filter((a) => a.offsetParent);
    const labels = [...root.querySelectorAll('[data-slot="sidebar-group-label"]')].map((button) => {
      const range = document.createRange();
      range.selectNodeContents([...button.childNodes].find((n) => n.nodeType === 3));
      const text = range.getBoundingClientRect();
      const chevron = button.querySelector('svg');
      return { text: button.textContent.trim(), textLeft: text.left, textRight: text.right, chevron: box(chevron), button: box(button), radius: radius(button) };
    });
    const profile = one('[data-slot="shell-profile"]');
    const trigger = profile.querySelector('[data-slot="account-trigger"]');
    const chevron = trigger.querySelector('svg');
    const accountName = trigger.querySelector('[data-slot="account-name"]');
    const accountEmail = trigger.querySelector('[data-slot="account-email"]');
    const panelEl = document.querySelector('#app-main')?.parentElement;
    const avatar = profile.querySelector('[data-slot="avatar"]');
    const newChat = one('button[aria-label="New chat"]');
    const search = one('button[aria-label="Search"]');
    const mark = one('[data-slot="mark"]');
    return {
      root: box(root),
      viewport: innerWidth,
      mark: box(mark),
      search: { ...box(search), radius: radius(search) },
      panel: panelEl ? { ...box(panelEl), radius: radius(panelEl) } : null,
      trigger: { ...box(trigger), radius: radius(trigger), links: profile.querySelectorAll('a').length },
      newChat: { ...box(newChat), background: getComputedStyle(newChat).backgroundColor, radius: getComputedStyle(newChat).borderTopLeftRadius },
      links: links.map((a) => ({ name: (a.getAttribute('aria-label') ?? a.textContent.trim()).replace(/, \\d+ unread$/, ''), label: a.getAttribute('aria-label'), radius: radius(a), ...box(a), icon: box(a.querySelector('svg')), current: a.getAttribute('aria-current'), background: getComputedStyle(a).backgroundColor })),
      labels,
      profile: box(profile),
      avatar: box(avatar),
      chevron: box(chevron),
      accountName: { ...box(accountName), size: getComputedStyle(accountName).fontSize, weight: getComputedStyle(accountName).fontWeight, color: getComputedStyle(accountName).color, overflow: getComputedStyle(accountName).textOverflow },
      accountEmail: { ...box(accountEmail), size: getComputedStyle(accountEmail).fontSize, color: getComputedStyle(accountEmail).color, overflow: getComputedStyle(accountEmail).textOverflow },
      rootBackground: getComputedStyle(root).backgroundColor,
      fontFamily: getComputedStyle(root).fontFamily,
    };
  })()`)

const near = (a, b, tolerance = BOX) => Math.abs(a - b) <= tolerance

export function checkGeometry(check, tag, height, shape, active) {
  check(shape.root.w === 244, `${tag} sidebar is 244px wide (${shape.root.w})`)
  check(
    near(shape.mark.w, 20) && near(shape.mark.h, 20),
    `${tag} logo mark is 20x20`
  )
  check(
    near(shape.mark.x, 16) && near(shape.mark.y, 18),
    `${tag} logo mark sits at 16,18 (${shape.mark.x},${shape.mark.y})`
  )
  check(
    near(shape.search.w, 28) &&
      near(shape.search.h, 28) &&
      near(shape.newChat.w, 28) &&
      near(shape.newChat.h, 28),
    `${tag} search and new chat buttons are 28x28`
  )
  check(
    near(shape.search.r, 202) && near(shape.newChat.r, 232),
    `${tag} search and new chat sit at the top right (${shape.search.r}, ${shape.newChat.r})`
  )
  check(
    shape.newChat.background === "rgb(255, 255, 255)" &&
      parseFloat(shape.newChat.radius) >= 14,
    `${tag} new chat is a white circle`
  )
  check(
    near(shape.search.x, PEN.search.x) && near(shape.search.y, PEN.search.y),
    `${tag} search sits at ${PEN.search.x},${PEN.search.y} (${shape.search.x},${shape.search.y})`
  )
  check(
    near(shape.newChat.x, PEN.newChat.x) &&
      near(shape.newChat.y, PEN.newChat.y),
    `${tag} new chat sits at ${PEN.newChat.x},${PEN.newChat.y} (${shape.newChat.x},${shape.newChat.y})`
  )
  check(
    near(shape.search.radius, PEN.rowRadius),
    `${tag} search corner radius is ${PEN.rowRadius} (${shape.search.radius})`
  )
  check(
    parseFloat(shape.newChat.radius) >= PEN.newChatRadius,
    `${tag} new chat is round (${shape.newChat.radius})`
  )
  check(
    near(shape.trigger.radius, PEN.rowRadius),
    `${tag} account row corner radius is ${PEN.rowRadius} (${shape.trigger.radius})`
  )
  if (shape.panel)
    check(
      near(shape.panel.x, PEN.panel.x) &&
        near(shape.panel.y, PEN.panel.y) &&
        near(shape.panel.r, shape.viewport - PEN.panel.rightInset) &&
        near(shape.panel.radius, PEN.panel.radius),
      `${tag} main panel is at ${PEN.panel.x},${PEN.panel.y} to ${shape.viewport - PEN.panel.rightInset} with radius ${PEN.panel.radius} (${shape.panel.x},${shape.panel.y} to ${shape.panel.r}, radius ${shape.panel.radius})`
    )
  for (const link of shape.links) {
    check(
      near(link.h, 28) && near(link.w, 224) && near(link.x, 10),
      `${tag} row "${link.name}" is 224x28 at x 10 (${link.w}x${link.h} at ${link.x})`
    )
    check(
      near(link.icon.w, 16) &&
        near(link.icon.h, 16) &&
        near(link.icon.x, 18) &&
        near(link.icon.y - link.y, PEN.iconInset),
      `${tag} row "${link.name}" icon is 16x16 at x 18, ${PEN.iconInset}px below the row top (${link.icon.x}, ${(link.icon.y - link.y).toFixed(2)})`
    )
    check(
      near(link.radius, PEN.rowRadius),
      `${tag} row "${link.name}" corner radius is ${PEN.rowRadius} (${link.radius})`
    )
    const wantY = PEN.rows[link.name]
    if (wantY !== undefined)
      check(
        near(link.y, wantY),
        `${tag} row "${link.name}" top is ${wantY} (${link.y})`
      )
  }
  const current = shape.links.filter((link) => link.current === "page")
  check(
    current.length === 1 && current[0].name === active,
    `${tag} exactly "${active}" is the current page (${current.map((l) => l.name)})`
  )
  check(
    current[0]?.background === ACTIVE_BACKGROUND,
    `${tag} the active row is filled ${ACTIVE_BACKGROUND} (${current[0]?.background})`
  )
  check(
    shape.links
      .filter((link) => link.current !== "page")
      .every((link) => link.background === "rgba(0, 0, 0, 0)"),
    `${tag} no other row is filled`
  )
  for (const label of shape.labels) {
    check(
      near(label.chevron.w, 9) && near(label.chevron.h, 9),
      `${tag} "${label.text}" chevron is 9x9`
    )
    check(
      near(label.chevron.x - label.textRight, 4),
      `${tag} "${label.text}" chevron follows the label by 4px (${(label.chevron.x - label.textRight).toFixed(2)})`
    )
    check(
      near(label.button.h, 28) &&
        near(label.button.y, PEN.labels[label.text]) &&
        near(label.radius, PEN.rowRadius),
      `${tag} "${label.text}" group row is 28 tall at y ${PEN.labels[label.text]} with radius ${PEN.rowRadius} (${label.button.h} at ${label.button.y}, radius ${label.radius})`
    )
    check(
      near(label.textLeft - label.button.x, PEN.labelPaddingLeft) &&
        near(label.chevron.y - label.button.y, PEN.chevronInset),
      `${tag} "${label.text}" label is inset ${PEN.labelPaddingLeft}px and its chevron ${PEN.chevronInset}px below the row top (${(label.textLeft - label.button.x).toFixed(2)}, ${(label.chevron.y - label.button.y).toFixed(2)})`
    )
  }
  check(
    shape.labels.map((label) => label.text).join("|") === "Your work|Favorites",
    `${tag} group labels are Your work, Favorites`
  )
  check(
    near(shape.profile.h, PEN.footer.height) &&
      near(shape.profile.y + shape.profile.h, height - 12),
    `${tag} account footer is ${PEN.footer.height} tall and ends 12px above the bottom (${shape.profile.h})`
  )
  check(
    near(shape.avatar.w, PEN.footer.avatar) &&
      near(shape.avatar.h, PEN.footer.avatar) &&
      near(shape.avatar.y - shape.profile.y, (PEN.footer.height - 24) / 2),
    `${tag} account avatar is 24x24 and centred in the row (${shape.avatar.w}x${shape.avatar.h})`
  )
  check(
    shape.accountName.size === "13px" &&
      shape.accountName.weight === "500" &&
      shape.accountEmail.size === "11px" &&
      shape.accountName.overflow === "ellipsis" &&
      shape.accountEmail.overflow === "ellipsis" &&
      shape.accountEmail.y > shape.accountName.y,
    `${tag} account name is 13/500 over an 11px email, both truncated (${shape.accountName.size}/${shape.accountName.weight}, ${shape.accountEmail.size})`
  )
  check(
    near(shape.trigger.w, shape.profile.w) &&
      shape.trigger.links === 0 &&
      near(shape.chevron.w, 16) &&
      near(shape.chevron.r, shape.trigger.r - 8),
    `${tag} the account row is one full-width button with a chevron at the right and no separate gear (${shape.trigger.w}, ${shape.chevron.r})`
  )
}
