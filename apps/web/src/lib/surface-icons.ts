import {
  BadgeCheck,
  Briefcase,
  CircleHelp,
  FileText,
  Inbox,
  type LucideIcon,
  MessageCircle,
  Presentation,
  Settings,
  Sparkles,
  SquareKanban,
} from "lucide-react"

import type { SurfaceId } from "@/lib/product-paths.ts"

export const SURFACE_ICONS: Record<SurfaceId, LucideIcon> = {
  inbox: Inbox,
  coach: MessageCircle,
  jobs: Briefcase,
  paper: FileText,
  apply: SquareKanban,
  pitch: Presentation,
  proofs: BadgeCheck,
  proof: BadgeCheck,
  settings: Settings,
  help: CircleHelp,
  upgrade: Sparkles,
  purchase: Sparkles,
}
