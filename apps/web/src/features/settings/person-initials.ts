export function personName(name: string, email: string) {
  return name.trim() || email.trim().split("@")[0] || "Account"
}

export function personInitials(name: string, email: string) {
  const parts = personName(name, email).split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || email.trim().charAt(0).toUpperCase() || "You"
}
