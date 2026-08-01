import { Card, CardContent } from "@/components/ui/card";

interface ProofSessionSummaryProps {
  proofsBuilt: number;
  totalProofs: number;
  claimsVerified: number;
  totalClaims: number;
}

/**
 * Goal-Gradient: a quiet running count of proofs built and claims verified
 * across the whole session, not just the current context, so switching
 * context never resets visible progress.
 */
export function ProofSessionSummary({ proofsBuilt, totalProofs, claimsVerified, totalClaims }: ProofSessionSummaryProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="text-sm">
          <span className="font-medium text-foreground">{proofsBuilt}</span>{" "}
          <span className="text-muted-foreground">of {totalProofs} proofs built</span>
        </span>
        <span className="text-sm">
          <span className="font-medium text-foreground">{claimsVerified}</span>{" "}
          <span className="text-muted-foreground">of {totalClaims} claims well supported</span>
        </span>
      </CardContent>
    </Card>
  );
}
