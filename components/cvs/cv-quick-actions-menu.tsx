"use client";

import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CvVersion } from "@/lib/types";

interface CvQuickActionsMenuProps {
  cv: CvVersion;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * The actions menu on every CV card: open, duplicate (into the new-version
 * flow, preselected to this card), and delete with confirm. Mirrors
 * OpportunityQuickActionsMenu's stopPropagation pattern so it works whether
 * the card itself links to the detail page.
 */
export function CvQuickActionsMenu({ cv, onDuplicate, onDelete }: CvQuickActionsMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={`Actions for ${cv.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>{cv.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(`/cvs/${cv.id}`)}>Open</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="size-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
