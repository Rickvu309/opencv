export type PrintJob = { id: number; title: string } | null

export type PrintJobAction =
  { type: "print_requested"; title: string } | { type: "print_finished" }

export function printJobReducer(
  job: PrintJob,
  action: PrintJobAction
): PrintJob {
  switch (action.type) {
    case "print_requested":
      return { id: (job?.id ?? 0) + 1, title: action.title }
    case "print_finished":
      return null
  }
}
