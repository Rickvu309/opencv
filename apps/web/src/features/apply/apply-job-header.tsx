import { Link } from "@tanstack/react-router"
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Link as LinkIcon,
  PanelRight,
  Star,
  Trash2,
} from "lucide-react"

import type { JobDetail } from "@workspace/domain/apply"
import { Button } from "@workspace/ui/components/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { copyText } from "@workspace/ui/components/copy-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  PageHeader,
  PageHeaderAction,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderLeading,
  PageHeaderMeta,
  PageHeaderTitleActions,
} from "@workspace/ui/components/page-header"
import { toast } from "@workspace/ui/components/sonner"
import { cn } from "@workspace/ui/lib/utils"

import { FAINT_TEXT } from "./apply-tone.ts"
import "./design/page-header.css"

async function copyLink() {
  const copied = await copyText(window.location.href).catch(() => false)
  toast(copied ? "Link copied" : "Could not copy the link. Try again.")
}

export function JobHeader({
  job,
  position,
  total,
  onPrevious,
  onNext,
  railOpen,
  onToggleRail,
  onToggleStar,
  onDelete,
}: {
  job: JobDetail
  position: number
  total: number
  onPrevious: (() => void) | null
  onNext: (() => void) | null
  railOpen: boolean
  onToggleRail: () => void
  onToggleStar: () => void
  onDelete: () => void
}) {
  return (
    <PageHeader>
      <PageHeaderLeading>
        <PageHeaderBack render={<Link to="/apply" />}>Apply</PageHeaderBack>
      </PageHeaderLeading>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/apply" />}>Apply</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage icon={<Briefcase />}>{job.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeaderTitleActions>
        <PageHeaderAction
          label="Favorite"
          icon={
            <Star
              className={cn(job.starred && "fill-current text-foreground")}
            />
          }
          pressed={job.starred}
          onSelect={onToggleStar}
        />
        <DropdownMenu>
          <PageHeaderAction
            label="More"
            icon={<Ellipsis />}
            className="max-md:hidden"
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    size="touch"
                    type="button"
                    variant="ghost"
                    data-slot="page-header-action"
                  />
                }
              />
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 aria-hidden="true" />
              Delete job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeaderTitleActions>
      {position > 0 ? (
        <PageHeaderMeta showOnPhone className={FAINT_TEXT.card}>
          {`${position} / ${total}`}
        </PageHeaderMeta>
      ) : null}
      <PageHeaderActions overflowLabel="More actions">
        <PageHeaderAction
          label="Previous job"
          icon={<ChevronUp />}
          disabled={!onPrevious}
          onSelect={() => onPrevious?.()}
          collapse
        />
        <PageHeaderAction
          label="Next job"
          icon={<ChevronDown />}
          disabled={!onNext}
          onSelect={() => onNext?.()}
          collapse
        />
        <PageHeaderAction
          label="Copy link"
          icon={<LinkIcon />}
          onSelect={() => void copyLink()}
          collapse
        />
        <PageHeaderAction
          label="Properties panel"
          icon={<PanelRight />}
          pressed={railOpen}
          onSelect={onToggleRail}
          collapse
        />
        <PageHeaderAction
          label="Delete job"
          icon={<Trash2 />}
          className="md:hidden"
          onSelect={onDelete}
          collapse
        />
      </PageHeaderActions>
    </PageHeader>
  )
}
