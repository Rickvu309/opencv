import Link from "next/link";
import { FileText, GraduationCap, Target } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotTag } from "@/components/shared/copilot-tag";

const USES = [
  {
    icon: Target,
    text: "Fit judgment: your target direction, strengths, and Fintra explainability work anchor every fit score in Opportunities.",
    href: "/opportunities",
    linkLabel: "See fit judgments",
  },
  {
    icon: FileText,
    text: "CV tailoring: your experience bullets get reordered and rewritten per opportunity, starting from the Meridian Labs tailored CV.",
    href: "/cvs/cv-3",
    linkLabel: "See a tailored CV",
  },
  {
    icon: GraduationCap,
    text: "Learning suggestions: gaps between your skills and target direction drive what shows up in Skills & Learning.",
    href: "/skills",
    linkLabel: "See learning suggestions",
  },
];

/**
 * Quiet rail card that names exactly how each part of the profile feeds
 * product behavior, so this page never reads as a settings form.
 */
export function ProfileCopilotUsesCard() {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>How the Copilot uses this</CardTitle>
          <CopilotTag />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {USES.map((use) => (
          <div key={use.href} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <use.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{use.text}</p>
            </div>
            <Link
              href={use.href}
              className="ml-[1.375rem] text-xs font-medium text-foreground underline-offset-2 hover:underline"
            >
              {use.linkLabel}
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
