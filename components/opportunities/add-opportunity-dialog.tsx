"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiThinking } from "@/components/shared/ai-thinking";
import { CopilotTag } from "@/components/shared/copilot-tag";
import { FitChip } from "@/components/shared/fit-chip";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { matchParseSample } from "@/lib/data/parse-samples";
import { persona } from "@/lib/data/persona";
import { makeId, today, useStore } from "@/lib/store";
import type {
  ActivityMoment,
  AiInsight,
  ConfidenceLevel,
  CredibilityInsight,
  FitInsight,
  FitLevel,
  InterpretationInsight,
  NextAction,
  Opportunity,
  OpportunityStatus,
  SummaryInsight,
} from "@/lib/types";

const STATUS_OPTIONS: OpportunityStatus[] = ["Saved", "Applied", "Interview", "Offer", "Closed"];

const HINT_PLACEHOLDER = "Copilot suggests adding this";

interface DraftFields {
  role: string;
  company: string;
  location: string;
  salaryRange: string;
  source: string;
  status: OpportunityStatus;
  notes: string;
}

interface PasteDraft extends DraftFields {
  tags: string[];
  fit: FitLevel;
  fitRationale: string;
  confidence: ConfidenceLevel;
}

const EMPTY_MANUAL_DRAFT: DraftFields = {
  role: "",
  company: "",
  location: "",
  salaryRange: "",
  source: "",
  status: "Saved",
  notes: "",
};

function buildOpportunityFromDraft(
  draft: DraftFields,
  fit: FitLevel,
  fallbackSource: string
): Opportunity {
  const role = draft.role.trim();
  const company = draft.company.trim();
  const location = draft.location.trim() || "Location not specified yet.";
  const dateStamp = today();

  return {
    id: makeId("opp"),
    role,
    company,
    location,
    remote: /remote/i.test(location),
    status: draft.status,
    fit,
    priority: "Medium",
    isDream: false,
    source: draft.source.trim() || fallbackSource,
    salaryRange: draft.salaryRange.trim() || "Not shared yet.",
    description:
      draft.notes.trim() || "No additional notes were added when this opportunity was saved.",
    savedAt: dateStamp,
    lastActivityAt: dateStamp,
  };
}

function buildIntakeSummaryInsight(opportunity: Opportunity, viaCopilotParse: boolean): SummaryInsight {
  const body = viaCopilotParse
    ? `${opportunity.role} at ${opportunity.company}, structured from a pasted listing. ${opportunity.description}`
    : `${opportunity.role} at ${opportunity.company}, added manually to Saved. ${opportunity.description}`;

  return {
    id: makeId("insight"),
    kind: "summary",
    hostType: "opportunity",
    hostId: opportunity.id,
    createdAt: today(),
    body,
  };
}

function buildIntakeInterpretationInsight(
  opportunity: Opportunity,
  viaCopilotParse: boolean
): InterpretationInsight {
  const plainLanguageRead = viaCopilotParse
    ? `${opportunity.role} at ${opportunity.company} was structured from your paste. This first read covers only what Copilot could extract, confirm it against the full listing.`
    : `${opportunity.role} at ${opportunity.company} was entered manually, so this reading reflects only the notes you provided rather than a parsed listing.`;

  return {
    id: makeId("insight"),
    kind: "interpretation",
    hostType: "opportunity",
    hostId: opportunity.id,
    createdAt: today(),
    plainLanguageRead,
    expectations: [
      {
        id: makeId("exp"),
        label: `Scope centers on ${opportunity.role}`,
        rationale: `Structured from ${viaCopilotParse ? "the pasted listing" : "the details you entered"}, this is the primary scope Copilot will track fit and next actions against.`,
      },
      {
        id: makeId("exp"),
        label: `Sourced as "${opportunity.source}"`,
        rationale: "Worth weighing how that channel usually holds up when judging credibility below.",
      },
    ],
    vagueLanguage: {
      phrase: opportunity.description,
      decoded:
        "Nothing has been parsed out of this yet beyond what's shown here. Add more detail to the listing or notes for a sharper read.",
    },
    whyThisReading: `Based only on the ${viaCopilotParse ? "parsed" : "manually entered"} fields available right now, this reading will sharpen as more detail is added.`,
    confidence: "Low",
  };
}

function buildIntakeCredibilityInsight(
  opportunity: Opportunity,
  viaCopilotParse: boolean
): CredibilityInsight {
  const positiveSignals: CredibilityInsight["positiveSignals"] = [];
  const cautionSignals: CredibilityInsight["cautionSignals"] = [];

  if (opportunity.salaryRange && opportunity.salaryRange !== "Not shared yet.") {
    positiveSignals.push({
      id: makeId("cred"),
      label: "Salary range was provided",
      why: `A stated range of ${opportunity.salaryRange} gives Copilot something concrete to check against market data later.`,
    });
  } else {
    cautionSignals.push({
      id: makeId("cred"),
      label: "No salary range yet",
      why: "Nothing to compare against market rates until a range is added.",
    });
  }

  if (viaCopilotParse) {
    positiveSignals.push({
      id: makeId("cred"),
      label: "Sourced from a real paste",
      why: `Structured from a pasted listing via ${opportunity.source}, rather than starting from a blank form.`,
    });
  } else {
    cautionSignals.push({
      id: makeId("cred"),
      label: "Entered manually, unverified",
      why: "No listing was parsed, so nothing here has been checked against outside sources yet.",
    });
  }

  return {
    id: makeId("insight"),
    kind: "credibility",
    hostType: "opportunity",
    hostId: opportunity.id,
    createdAt: today(),
    verdict: cautionSignals.length > positiveSignals.length ? "fail" : "pass",
    positiveSignals,
    cautionSignals,
    whyThisReading:
      "Based on what's been entered so far, this check will sharpen once more detail is confirmed.",
    confidence: "Low",
  };
}

function buildIntakeFitInsight(
  opportunity: Opportunity,
  fit: FitLevel,
  fitRationale: string
): FitInsight {
  return {
    id: makeId("insight"),
    kind: "fit",
    hostType: "opportunity",
    hostId: opportunity.id,
    createdAt: today(),
    level: fit,
    strengths: fitRationale ? [fitRationale] : [],
    concerns: [
      `This reading is an initial pass only, revisit once you've reviewed the ${opportunity.role} listing yourself.`,
    ],
    unknowns: [`How this role compares against your target direction of ${persona.targetDirectionLabel} until more detail is confirmed.`],
    tradeoff: {
      gain: "An early read while the listing is fresh.",
      give: "Confidence, this hasn't been checked against your full profile in depth yet.",
    },
    alignmentLine: `Provisional against your target direction of ${persona.targetDirectionLabel} until confirmed.`,
    whyThisReading: "Built from the intake fields only, the AI Analysis tab will read as more detail is added.",
    confidence: "Low",
  };
}

function buildIntakeNextAction(opportunity: Opportunity): NextAction {
  return {
    id: makeId("action"),
    opportunityId: opportunity.id,
    verb: `Review the ${opportunity.role} listing and decide whether to move it to Applied`,
    rationale: `Just added to ${opportunity.status}, worth a first read while the listing is fresh.`,
    effort: "10 min",
    dueHint: "This week",
    state: "suggested",
    confidence: "Low",
    alternatives: [
      {
        id: makeId("alt"),
        verb: `Research ${opportunity.company} before deciding`,
        chooseWhen: "the listing or notes left the scope unclear.",
        rationale: "A closer look would sharpen the fit read before you commit any more time.",
        effort: "15 min",
        dueHint: "No rush",
        confidence: "Low",
      },
      {
        id: makeId("alt"),
        verb: `Archive ${opportunity.role} at ${opportunity.company} for now`,
        chooseWhen: "it doesn't look worth pursuing on a first read.",
        rationale: "Nothing here is confirmed enough yet to justify holding a slot in Saved.",
        effort: "2 min",
        dueHint: "This week",
        confidence: "Low",
      },
    ],
    whatWouldChangeThis:
      "If more detail is confirmed about the role or team, this reading will sharpen and this recommendation may change.",
  };
}

function buildIntakeActivityMoments(opportunity: Opportunity, viaCopilotParse: boolean): ActivityMoment[] {
  const dateStamp = opportunity.savedAt;
  const moments: ActivityMoment[] = [
    {
      id: makeId("activity"),
      opportunityId: opportunity.id,
      kind: "created",
      message: viaCopilotParse
        ? `Saved to Opportunities, structured by Copilot from a pasted listing (${opportunity.source}).`
        : `Saved to Opportunities, entered manually (${opportunity.source}).`,
      createdAt: dateStamp,
    },
  ];

  if (viaCopilotParse) {
    moments.push({
      id: makeId("activity"),
      opportunityId: opportunity.id,
      kind: "copilot-analysis",
      message: "Copilot parsed the pasted listing into structured fields and an initial fit signal.",
      createdAt: dateStamp,
    });
  }

  return moments;
}

export function AddOpportunityDialog({ children }: { children: React.ReactNode }) {
  const { addOpportunity } = useStore();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"paste" | "manual">("paste");

  const [pasteText, setPasteText] = useState("");
  const [pastePhase, setPastePhase] = useState<"input" | "thinking" | "preview">("input");
  const [pasteDraft, setPasteDraft] = useState<PasteDraft | null>(null);

  const [manualDraft, setManualDraft] = useState<DraftFields>(EMPTY_MANUAL_DRAFT);

  const parseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (parseTimeout.current) clearTimeout(parseTimeout.current);
    };
  }, []);

  function resetState() {
    setActiveTab("paste");
    setPasteText("");
    setPastePhase("input");
    setPasteDraft(null);
    setManualDraft(EMPTY_MANUAL_DRAFT);
    if (parseTimeout.current) clearTimeout(parseTimeout.current);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  function handleParse() {
    setPastePhase("thinking");
    const sample = matchParseSample(pasteText);
    parseTimeout.current = setTimeout(() => {
      setPasteDraft({
        role: sample.role,
        company: sample.company,
        location: sample.location,
        salaryRange: sample.salaryRange,
        source: sample.source,
        status: sample.status,
        notes: sample.notes,
        tags: sample.tags,
        fit: sample.fit,
        fitRationale: sample.fitRationale,
        confidence: sample.confidence,
      });
      setPastePhase("preview");
    }, 600 + Math.random() * 600);
  }

  function handleStartOver() {
    setPastePhase("input");
    setPasteDraft(null);
  }

  function updatePasteDraft(patch: Partial<PasteDraft>) {
    setPasteDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateManualDraft(patch: Partial<DraftFields>) {
    setManualDraft((current) => ({ ...current, ...patch }));
  }

  const isPasteReady = activeTab === "paste" && pastePhase === "preview" && pasteDraft !== null;
  const isManualReady = activeTab === "manual";
  const activeDraft: DraftFields | null = isPasteReady ? pasteDraft : isManualReady ? manualDraft : null;
  const canSave = Boolean(activeDraft && activeDraft.role.trim() && activeDraft.company.trim());

  function handleSave() {
    if (!activeDraft || !canSave) return;

    const fit = isPasteReady && pasteDraft ? pasteDraft.fit : "Unknown";
    const fallbackSource = isPasteReady ? "Pasted into Copilot" : "Added manually";
    const opportunity = buildOpportunityFromDraft(activeDraft, fit, fallbackSource);

    const nextAction = buildIntakeNextAction(opportunity);
    opportunity.nextActionId = nextAction.id;
    const fitRationale = isPasteReady && pasteDraft ? pasteDraft.fitRationale : "";
    const insights: AiInsight[] = [
      buildIntakeSummaryInsight(opportunity, isPasteReady),
      buildIntakeInterpretationInsight(opportunity, isPasteReady),
      buildIntakeCredibilityInsight(opportunity, isPasteReady),
      buildIntakeFitInsight(opportunity, fit, fitRationale),
    ];
    const activityMoments = buildIntakeActivityMoments(opportunity, isPasteReady);

    addOpportunity(opportunity, insights, nextAction, activityMoments);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add opportunity</DialogTitle>
          <DialogDescription>
            Paste a listing for Copilot to structure, or enter the details yourself.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "paste" | "manual")}>
          <TabsList>
            <TabsTrigger value="paste">Paste</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="flex flex-col gap-4 pt-4">
            {pastePhase === "preview" && pasteDraft ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CopilotTag />
                    <span className="text-xs text-muted-foreground">
                      Structured from your paste. Review and edit before saving.
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleStartOver}>
                    Paste something else
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role">
                    <Input
                      value={pasteDraft.role}
                      placeholder={HINT_PLACEHOLDER}
                      onChange={(event) => updatePasteDraft({ role: event.target.value })}
                    />
                  </Field>
                  <Field label="Company">
                    <Input
                      value={pasteDraft.company}
                      placeholder={HINT_PLACEHOLDER}
                      onChange={(event) => updatePasteDraft({ company: event.target.value })}
                    />
                  </Field>
                  <Field label="Location">
                    <Input
                      value={pasteDraft.location}
                      placeholder={HINT_PLACEHOLDER}
                      onChange={(event) => updatePasteDraft({ location: event.target.value })}
                    />
                  </Field>
                  <Field label="Salary range">
                    <Input
                      value={pasteDraft.salaryRange}
                      placeholder={HINT_PLACEHOLDER}
                      onChange={(event) => updatePasteDraft({ salaryRange: event.target.value })}
                    />
                  </Field>
                  <Field label="Source">
                    <Input
                      value={pasteDraft.source}
                      placeholder={HINT_PLACEHOLDER}
                      onChange={(event) => updatePasteDraft({ source: event.target.value })}
                    />
                  </Field>
                  <Field label="Status">
                    <Select
                      value={pasteDraft.status}
                      onValueChange={(value) => updatePasteDraft({ status: value as OpportunityStatus })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Notes">
                  <Textarea
                    rows={3}
                    value={pasteDraft.notes}
                    placeholder={HINT_PLACEHOLDER}
                    onChange={(event) => updatePasteDraft({ notes: event.target.value })}
                  />
                </Field>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Suggested tags</span>
                    <CopilotTag />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pasteDraft.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Initial fit signal</span>
                    <div className="flex items-center gap-1.5">
                      <FitChip fit={pasteDraft.fit} />
                      <ConfidenceChip confidence={pasteDraft.confidence} />
                      <CopilotTag />
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{pasteDraft.fitRationale}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="paste-input">Paste a job link, a job description, or rough notes</Label>
                  <Textarea
                    id="paste-input"
                    rows={8}
                    value={pasteText}
                    disabled={pastePhase === "thinking"}
                    placeholder="Paste a job link, a job description, or rough notes"
                    onChange={(event) => setPasteText(event.target.value)}
                  />
                </div>
                {pastePhase === "thinking" ? (
                  <AiThinking label="Parsing" />
                ) : (
                  <Button onClick={handleParse} disabled={!pasteText.trim()}>
                    <Sparkles className="size-4" />
                    Parse with Copilot
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="flex flex-col gap-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role title">
                <Input
                  value={manualDraft.role}
                  onChange={(event) => updateManualDraft({ role: event.target.value })}
                  placeholder="Senior Product Designer"
                />
              </Field>
              <Field label="Company">
                <Input
                  value={manualDraft.company}
                  onChange={(event) => updateManualDraft({ company: event.target.value })}
                  placeholder="Company name"
                />
              </Field>
              <Field label="Source">
                <Input
                  value={manualDraft.source}
                  onChange={(event) => updateManualDraft({ source: event.target.value })}
                  placeholder="Referral, job board, company site"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={manualDraft.status}
                  onValueChange={(value) => updateManualDraft({ status: value as OpportunityStatus })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location">
                <Input
                  value={manualDraft.location}
                  onChange={(event) => updateManualDraft({ location: event.target.value })}
                  placeholder="Remote, hybrid, or on-site city"
                />
              </Field>
              <Field label="Salary range">
                <Input
                  value={manualDraft.salaryRange}
                  onChange={(event) => updateManualDraft({ salaryRange: event.target.value })}
                  placeholder="$120,000 to $150,000 USD"
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={manualDraft.notes}
                onChange={(event) => updateManualDraft({ notes: event.target.value })}
                placeholder="What makes this one worth tracking"
              />
            </Field>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={!canSave}>
            Add to workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
