import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

const STATUSES: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];

/**
 * Compact status-count strip: one number per opportunity status, each
 * clicking through to the Opportunities workspace pre-filtered to that
 * status via the `status` query param.
 */
export function PipelineSnapshot({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>Pipeline snapshot</h2>
      <Card className="ring-foreground/8">
        <CardContent className="grid grid-cols-5 gap-2">
          {STATUSES.map((status) => {
            const count = opportunities.filter((opportunity) => opportunity.status === status).length;
            return (
              <Link
                key={status}
                href={`/opportunities?status=${status}`}
                className="flex flex-col items-center gap-0.5 rounded-lg py-2 text-center transition-colors hover:bg-muted/60"
              >
                <span className="text-xl font-semibold tracking-tight">{count}</span>
                <span className="text-xs text-muted-foreground">{status}</span>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
