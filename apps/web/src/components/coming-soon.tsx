export function ComingSoon({ silent = false }: { silent?: boolean }) {
  if (silent) {
    return <span className="sr-only">Coming soon</span>
  }
  return <span className="text-muted-foreground"> · Coming soon</span>
}
