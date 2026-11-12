import { FileText, Mail, MessagesSquare } from "lucide-react"

export const COACH_STARTERS = [
  {
    title: "Review my CV",
    description: "Get suggested edits that wait for your approval",
    icon: FileText,
  },
  {
    title: "Write a cover letter",
    description: "Draft a Letter for a Job you are tracking",
    icon: Mail,
  },
  {
    title: "Prep an interview",
    description: "Practice likely questions for one of your Jobs",
    icon: MessagesSquare,
  },
] as const
