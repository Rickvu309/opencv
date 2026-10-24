type NavigatorWithPlatform = Navigator & {
  userAgentData?: { platform?: string }
}

export function isApplePlatform(nav: NavigatorWithPlatform = navigator) {
  const platform = nav.userAgentData?.platform || nav.platform || ""
  return /mac|iphone|ipad|ipod/i.test(platform)
}

export function searchShortcutLabel(apple: boolean = isApplePlatform()) {
  return apple ? "⌘K" : "Ctrl K"
}
