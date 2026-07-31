import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Opportunity } from "@/lib/types";

interface ProfileUsedByCardProps {
  opportunities: Opportunity[];
}

/**
 * Which opportunities' fit analyses actually cite this profile, each a link
 * chip straight into that opportunity's AI Analysis tab, closing the loop
 * from profile content back to where it gets used.
 */
export function ProfileUsedByCard({ opportunities }: ProfileUsedByCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Used by</CardTitle>
      </CardHeader>
      <CardContent>
        {opportunities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {opportunities.map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/opportunities/${opportunity.id}#ai-analysis`}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
              >
                {opportunity.role} · {opportunity.company}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No fit analysis cites this profile yet."
            className="border-none bg-transparent px-0 py-2 text-left"
          />
        )}
      </CardContent>
    </Card>
  );
}
