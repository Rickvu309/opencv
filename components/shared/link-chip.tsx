import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

interface LinkChipProps {
  href: string;
  onClick?: () => void;
  children: ReactNode;
}

/**
 * Shared "linked object" chip: an outline badge wrapping a Link, used
 * everywhere a card points at a related Skill, Goal, Opportunity, or Track
 * Record entry (Track Record entries, learning items, skill rows, goal
 * cards, the direction gap analysis). Centralizing this here keeps that one
 * visual pattern identical across every surface that uses it.
 */
export function LinkChip({ href, onClick, children }: LinkChipProps) {
  return (
    <Badge variant="outline" asChild>
      <Link href={href} onClick={onClick}>
        {children}
      </Link>
    </Badge>
  );
}
