/**
 * Spec 3 placeholder until auth. Configurable via env; never the
 * "Eric Nguyen" demo persona (PRODUCT.md open question 4).
 */
export const DEFAULT_DEV_PROFILE_NAME = "Alex Tran"

export type DevProfile = {
  name: string
  avatarSrc: string
}

export function getDevProfile(): DevProfile {
  return {
    name: import.meta.env.VITE_DEV_PROFILE_NAME || DEFAULT_DEV_PROFILE_NAME,
    avatarSrc: import.meta.env.VITE_DEV_PROFILE_AVATAR || "",
  }
}

export function profileInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return "?"
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
