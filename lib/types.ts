// OpenPath domain types. Terms here follow CONTEXT.md exactly.

export type OpportunityStatus =
  | "Saved"
  | "Applied"
  | "Interview"
  | "Offer"
  | "Closed";

export type FitLevel = "Strong" | "Medium" | "Weak" | "Unknown";

export type Priority = "High" | "Medium" | "Low";

export type NextActionState = "suggested" | "accepted" | "done" | "dismissed";

export type InsightKind =
  | "summary"
  | "interpretation"
  | "credibility"
  | "fit"
  | "tailoring"
  | "gap";

export type ConfidenceLevel = "High" | "Medium" | "Low";

export type InsightHostType =
  | "opportunity"
  | "profile"
  | "trackRecordEntry"
  | "goal"
  | "skill";

// ---------------------------------------------------------------------------
// Opportunity
// ---------------------------------------------------------------------------

export interface Opportunity {
  id: string;
  role: string;
  company: string;
  location: string;
  remote: boolean;
  status: OpportunityStatus;
  fit: FitLevel;
  priority: Priority;
  isDream: boolean;
  source: string;
  salaryRange: string;
  description: string;
  savedAt: string;
  lastActivityAt: string;
  appliedAt?: string;
  nextActionId?: string;
  cvVersionId?: string;
  goalIds?: string[];
  hasCredibilityFlag?: boolean;
  companyContext?: string;
  responsibilities?: string[];
  requirements?: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// Activity moment
// ---------------------------------------------------------------------------

export type ActivityMomentKind =
  | "created"
  | "status-change"
  | "note-added"
  | "copilot-analysis"
  | "action-accepted"
  | "action-done"
  | "dream-flagged";

export interface ActivityMoment {
  id: string;
  opportunityId: string;
  kind: ActivityMomentKind;
  message: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  start: string;
  end: string;
  summary: string;
}

export interface ProfilePreferences {
  remote: boolean;
  location: string;
  roleTypes: string[];
  compensationNote: string;
  workStyle: "Remote" | "Hybrid" | "On-site";
  companySize: string;
}

export interface Profile {
  name: string;
  headline: string;
  currentRole: string;
  experienceLevel: string;
  location: string;
  yearsExperience: number;
  summary: string;
  strengths: string[];
  experience: ExperienceEntry[];
  preferences: ProfilePreferences;
  targetDirection: string;
  targetDirectionLabel: string;
  nearTermPriority: string;
}

// ---------------------------------------------------------------------------
// CV Version
// ---------------------------------------------------------------------------

export interface CvSection {
  id: string;
  title: string;
  content: string;
}

export interface CvVersion {
  id: string;
  name: string;
  kind: "base" | "tailored";
  opportunityId?: string;
  sections: CvSection[];
  lastEditedAt: string;
}

// ---------------------------------------------------------------------------
// Track Record
// ---------------------------------------------------------------------------

export type TrackRecordStatus = "confirmed" | "candidate";

export interface TrackRecordEntry {
  id: string;
  title: string;
  story: string;
  impact: string;
  date: string;
  evidenceTag: string;
  skillIds: string[];
  status: TrackRecordStatus;
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export type GoalStatus = "not started" | "in progress" | "on track" | "at risk";

export interface Goal {
  id: string;
  title: string;
  why: string;
  targetDate: string;
  progressNote: string;
  status: GoalStatus;
  opportunityIds?: string[];
  learningItemIds?: string[];
}

// ---------------------------------------------------------------------------
// Skill / Learning
// ---------------------------------------------------------------------------

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: number;
  targetLevel: number;
  isGap: boolean;
  trackRecordEntryIds?: string[];
  learningItemIds?: string[];
}

export type LearningItemType = "course" | "project" | "habit";
export type LearningItemState = "suggested" | "planned" | "dismissed";

export interface LearningItem {
  id: string;
  title: string;
  type: LearningItemType;
  effort: string;
  skillId?: string;
  goalId?: string;
  state: LearningItemState;
}

// ---------------------------------------------------------------------------
// AI Insight (discriminated by kind)
// ---------------------------------------------------------------------------

interface AiInsightBase {
  id: string;
  hostType: InsightHostType;
  hostId: string;
  createdAt: string;
}

export interface SummaryInsight extends AiInsightBase {
  kind: "summary";
  body: string;
}

// ---------------------------------------------------------------------------
// Interpretation (AI Analysis tab, layer 1: "What this role really asks for")
// ---------------------------------------------------------------------------

export interface ExpectationRow {
  id: string;
  label: string;
  rationale: string;
}

export interface VagueLanguageDecode {
  phrase: string;
  decoded: string;
}

export interface InterpretationInsight extends AiInsightBase {
  kind: "interpretation";
  plainLanguageRead: string;
  expectations: ExpectationRow[];
  vagueLanguage: VagueLanguageDecode;
  whyThisReading: string;
  confidence: ConfidenceLevel;
}

// ---------------------------------------------------------------------------
// Credibility (AI Analysis tab, layer 2: "Is this worth your attention")
// ---------------------------------------------------------------------------

export interface CredibilitySignal {
  id: string;
  label: string;
  why: string;
}

export interface CredibilityInsight extends AiInsightBase {
  kind: "credibility";
  verdict: "pass" | "fail";
  positiveSignals: CredibilitySignal[];
  cautionSignals: CredibilitySignal[];
  whyThisReading: string;
  confidence: ConfidenceLevel;
}

// ---------------------------------------------------------------------------
// Fit (AI Analysis tab, layer 3: "How it fits you")
// ---------------------------------------------------------------------------

export interface FitTradeoff {
  gain: string;
  give: string;
}

export interface FitInsight extends AiInsightBase {
  kind: "fit";
  level: FitLevel;
  strengths: string[];
  concerns: string[];
  unknowns: string[];
  tradeoff: FitTradeoff;
  alignmentLine: string;
  whyThisReading: string;
  confidence: ConfidenceLevel;
}

export type TailoringSuggestionState = "suggested" | "accepted" | "dismissed";

export interface TailoringSuggestion {
  id: string;
  section: string;
  suggestion: string;
  state: TailoringSuggestionState;
}

export interface TailoringInsight extends AiInsightBase {
  kind: "tailoring";
  suggestions: TailoringSuggestion[];
  confidence: ConfidenceLevel;
}

export interface GapInsight extends AiInsightBase {
  kind: "gap";
  skillId: string;
  note: string;
  confidence: ConfidenceLevel;
}

export type AiInsight =
  | SummaryInsight
  | InterpretationInsight
  | CredibilityInsight
  | FitInsight
  | TailoringInsight
  | GapInsight;

// ---------------------------------------------------------------------------
// Next Action
// ---------------------------------------------------------------------------

/**
 * What happens automatically, without applying itself, once a next action is
 * marked done: a fresh suggested next action Copilot proposes as the logical
 * follow-up (for example after "research the team", "reach out to the
 * design director").
 */
export interface NextActionFollowUp {
  verb: string;
  rationale: string;
  effort: string;
  dueHint: string;
  confidence: ConfidenceLevel;
}

/**
 * Where an accepted next action hands off to next: a "tailor CV" action
 * links into the Materials tab, a research action opens the Copilot panel
 * with a scripted research summary.
 */
export type NextActionHandoff = "materials" | "copilot";

/**
 * One alternate path shown as a compact card in the Actions tab's
 * Alternatives zone. Carries the same shape a next action needs so accepting
 * it can fully replace the primary recommendation.
 */
export interface NextActionAlternative {
  id: string;
  verb: string;
  chooseWhen: string;
  rationale: string;
  effort: string;
  dueHint: string;
  confidence: ConfidenceLevel;
  followUp?: NextActionFollowUp;
  handoff?: NextActionHandoff;
  copilotPrompt?: string;
}

export interface NextAction {
  id: string;
  opportunityId: string;
  verb: string;
  rationale: string;
  effort: string;
  dueHint: string;
  state: NextActionState;
  confidence: ConfidenceLevel;
  alternatives?: NextActionAlternative[];
  whatWouldChangeThis?: string;
  followUp?: NextActionFollowUp;
  handoff?: NextActionHandoff;
  copilotPrompt?: string;
}

// ---------------------------------------------------------------------------
// Nudge / Weekly Review
// ---------------------------------------------------------------------------

export type NudgeTrigger = "stale-opportunity" | "capture-prompt" | "high-potential";
export type NudgeState = "active" | "dismissed" | "snoozed";

export interface Nudge {
  id: string;
  trigger: NudgeTrigger;
  message: string;
  suggestedAction: string;
  relatedOpportunityId?: string;
  state: NudgeState;
}

export type WeeklyReviewSuggestionState = "suggested" | "accepted" | "dismissed";

export interface WeeklyReviewSuggestion {
  id: string;
  text: string;
  state: WeeklyReviewSuggestionState;
}

export interface WeeklyReviewScript {
  whatHappened: string[];
  whatChanged: string[];
  suggestedFocus: WeeklyReviewSuggestion[];
}

// ---------------------------------------------------------------------------
// Copilot
// ---------------------------------------------------------------------------

export interface CopilotExchange {
  id: string;
  prompt: string;
  response: string;
}

export interface CopilotSurfaceScript {
  surface: string;
  suggestedPrompts: string[];
  exchanges: CopilotExchange[];
}

export interface CopilotMessage {
  id: string;
  role: "user" | "copilot";
  text: string;
  createdAt: string;
}
