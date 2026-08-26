export function destructiveConfirmDescription(name: string | null) {
  return name
    ? `Delete “${name}”? This cannot be undone.`
    : "This cannot be undone."
}
