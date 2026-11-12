export function personInitials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || email.trim().charAt(0).toUpperCase() || "You"
}
