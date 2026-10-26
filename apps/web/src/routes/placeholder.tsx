function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <h1 className="px-6 py-8 text-xl font-medium text-foreground">{title}</h1>
    </div>
  )
}

export function JobsPage() {
  return <PlaceholderPage title="Jobs" />
}

export function ProofsPage() {
  return <PlaceholderPage title="Proofs" />
}

export function InboxPage() {
  return <PlaceholderPage title="Inbox" />
}
