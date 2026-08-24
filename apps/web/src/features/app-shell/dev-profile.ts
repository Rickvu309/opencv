/**
 * Spec 3 placeholder until auth. Configurable via env; never the
 * "Eric Nguyen" demo persona (PRODUCT.md open question 4).
 */
export const DEFAULT_DEV_PROFILE_NAME = "Alex Tran"
const DEFAULT_DEV_PROFILE_EMAIL = "you@openpath.app"

export type DevProfile = {
  name: string
  email: string
  avatarSrc: string
}

export function getDevProfile(): DevProfile {
  return {
    name: import.meta.env.VITE_DEV_PROFILE_NAME || DEFAULT_DEV_PROFILE_NAME,
    email: import.meta.env.VITE_DEV_PROFILE_EMAIL || DEFAULT_DEV_PROFILE_EMAIL,
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
