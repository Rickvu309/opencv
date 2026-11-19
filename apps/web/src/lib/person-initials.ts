export function personInitials(name: string, email: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
  return letters.join("") || email.trim().charAt(0).toUpperCase()
}
