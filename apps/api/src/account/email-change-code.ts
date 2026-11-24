export type EmailChangeCodeOutcome = "sent" | "outside a request" | "refused"

export type EmailChangeCode = (email: string) => Promise<EmailChangeCodeOutcome>

let hosted: EmailChangeCode = async () => "outside a request"

export function hostEmailChangeCode(sender: EmailChangeCode) {
  hosted = sender
}

export function sendEmailChangeCode(email: string) {
  return hosted(email)
}
