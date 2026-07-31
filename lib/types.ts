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
  | "dream-flagged"
  | "cv-tailored"
  | "signal-accepted"
  | "evidence-linked";

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
  bullets: string[];
}

export interface ProfilePreferences {
  remote: boolean;
  location: string;
  roleTypes: string[];
  compensationNote: string;
  workStyle: "Remote" | "Hybrid" | "On-site";
  companySize: string;
  salaryFloor: string;
  dealBreakers: string[];
}

/**
 * One-line evidence note behind a strength chip on the Profile page, linked
 * back to the track record entry that proves it where seed data has one.
 */
export interface StrengthEvidence {
  strength: string;
  note: string;
  trackRecordEntryId?: string;
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
  strengthEvidence: StrengthEvidence[];
  experience: ExperienceEntry[];
  preferences: ProfilePreferences;
  targetDirection: string;
  targetDirectionLabel: string;
  targetDirectionHorizon: string;
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

export type TrackRecordUsedInKind = "cv" | "opportunity";

/**
 * One place a confirmed entry has already been put to work, from seed data
 * only: a CV version that cites it, or an opportunity whose positioning
 * leans on it.
 */
export interface TrackRecordUsedInRef {
  kind: TrackRecordUsedInKind;
  id: string;
  label: string;
}

export interface TrackRecordEntry {
  id: string;
  title: string;
  story: string;
  impact: string;
  date: string;
  evidenceTag: string;
  skillIds: string[];
  status: TrackRecordStatus;
  /** Confirmed-entry depth: a short note on what backs this entry up, shown on expand. */
  evidenceNote?: string;
  /** Confirmed-entry depth: where this entry has already been cited or relied on. */
  usedIn?: TrackRecordUsedInRef[];
  /** Confirmed-entry depth: one line naming the goal or opportunity positioning this entry supports. */
  strengthens?: string;
  /** Candidate-only: why Copilot drafted this, referencing the triggering context. */
  whySuggested?: string;
  /** Candidate-only: a hint at what evidence would back the draft once confirmed. */
  evidenceHint?: string;
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export type GoalStatus = "on track" | "needs attention" | "parked";

export type GoalHorizon = "near term" | "long term";

/** One append-only progress note on a goal, oldest first in the array. */
export interface GoalProgressNote {
  id: string;
  note: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  why: string;
  targetDate: string;
  horizon: GoalHorizon;
  status: GoalStatus;
  progressNotes: GoalProgressNote[];
  opportunityIds?: string[];
  learningItemIds?: string[];
}

// ---------------------------------------------------------------------------
// Path scenario ("Where this can go", Goals Zone 2)
// ---------------------------------------------------------------------------

/**
 * One framing aid on the Goals page showing a plausible path forward. Never
 * a commitment: the user can mark one as the target direction, which updates
 * the direction band, but nothing here applies itself.
 */
export interface PathScenario {
  id: string;
  title: string;
  description: string;
  optimizesFor: string;
  tradeoff: string;
  fitWithStrengths: FitLevel;
  nextSixMonths: string[];
  isClosestToCurrentTrajectory?: boolean;
  /** One-line reason, present only when isClosestToCurrentTrajectory is true. */
  closestReason?: string;
  /** Path Planner zone 2/3: how sure Copilot is in this path reading. */
  confidence: ConfidenceLevel;
  /** Path Planner zone 2: the two-line why, grounded in named strengths, track record entries, and pipeline signals. */
  whySummary: string;
  /** Path Planner zone 2: the expandable "Why this reading" detail behind whySummary. */
  whyThisReading: string;
  /** Path Planner zone 3: where this path stands today, one line. */
  readinessToday: string;
  /** Path Planner zone 3: how long until this path is viable, one line. */
  timeToViable: string;
  /** Path Planner zone 3: how strong the supporting evidence is, reusing FitLevel's Strong/Medium/Weak vocabulary. */
  evidenceStrength: FitLevel;
}

// ---------------------------------------------------------------------------
// Direction gap analysis (Goals Zone 3)
// ---------------------------------------------------------------------------

/** One strength already backed by track record evidence, in the Already aligned group. */
export interface DirectionAlignedItem {
  id: string;
  label: string;
  evidenceNote: string;
  trackRecordEntryId?: string;
}

/** One skill or experience gap, each linking to a skill and, where one exists, a learning item. */
export interface DirectionMissingItem {
  id: string;
  label: string;
  note: string;
  skillId?: string;
  learningItemId?: string;
}

/** One honest unknown: not yet resolved as aligned or missing. */
export interface DirectionUncertainItem {
  id: string;
  label: string;
  note: string;
}

export interface DirectionGapAnalysis {
  aligned: DirectionAlignedItem[];
  missing: DirectionMissingItem[];
  uncertain: DirectionUncertainItem[];
  pathIntoLearningNote: string;
}

// ---------------------------------------------------------------------------
// Path Planner: staged growth plan and gap analysis for one working path
// scenario at a time (the working path is whichever PathScenario the store's
// workingPathScenarioId points at).
// ---------------------------------------------------------------------------

export type PlanItemType = "learn" | "build" | "prove" | "pursue";

export type PlanStage = "now" | "months-1-3" | "months-4-6";

export type PlanItemState = "suggested" | "accepted" | "dismissed";

/**
 * One concrete item in the staged growth plan roadmap for a given path
 * scenario. "learn" items link an existing Skill and LearningItem, so
 * accepting one also plans that learning item, the same way accepting it
 * would from Skills & Learning directly. "build", "prove", and "pursue"
 * items persist only in this planner collection: there is no existing
 * object type yet for a portfolio project, a piece of captured evidence, or
 * a change in how an opportunity is pursued.
 */
export interface PlanItem {
  id: string;
  scenarioId: string;
  stage: PlanStage;
  type: PlanItemType;
  title: string;
  detail: string;
  state: PlanItemState;
  /** Goal-Gradient: already true today, backed by a track record entry, shown without accept or dismiss controls. */
  alreadyDone?: boolean;
  linkedSkillId?: string;
  linkedLearningItemId?: string;
  linkedGoalId?: string;
  linkedOpportunityId?: string;
  trackRecordEntryId?: string;
}

/** When a gap analysis row matters most: right away, or before the horizon closes. */
export type GapTiming = "now" | "by month 6";

/** One ranked skill gap row in the planner's gap analysis, timed against the working path. */
export interface PlannerSkillGap {
  skillId: string;
  timing: GapTiming;
}

/** One evidence gap: proof the working path still needs, honestly named. */
export interface PlannerProofGap {
  id: string;
  label: string;
  note: string;
  timing: GapTiming;
  linkedLearningItemId?: string;
  proposedActionLabel: string;
  proposedActionHref: string;
}

/** The planner's gap and proof analysis for one path scenario. */
export interface PlannerGapAnalysis {
  scenarioId: string;
  skills: PlannerSkillGap[];
  proof: PlannerProofGap[];
}

// ---------------------------------------------------------------------------
// Skill / Learning
// ---------------------------------------------------------------------------

export interface Skill {
  id: string;
  name: string;
  category: string;
  /** 1 to 4: Beginning, Working, Strong, Expert. See LEVEL_LABELS in lib/data/skills.ts. */
  level: number;
  targetLevel: number;
  isGap: boolean;
  /** User-set priority marker, independent of isGap: "I'm focusing on this one now." */
  isFocus: boolean;
  /** One line tying this skill to the profile's current target direction. */
  targetDirectionRelevance: string;
  trackRecordEntryIds?: string[];
  learningItemIds?: string[];
  /** Opportunities whose fit analysis names this skill directly, for the "which opportunities require it" chips. */
  relatedOpportunityIds?: string[];
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
  /** One line naming the skill-level move and the opportunity or goal it unblocks. */
  expectedBenefit: string;
  /** Present only on the one item recommended as the first step, a one-line reason why. */
  startHereReason?: string;
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

/**
 * The kind of edit a tailoring suggestion makes, shown as a small label next
 * to the before and after text so the change reads as one of a handful of
 * recognizable moves rather than an unlabeled rewrite.
 */
export type TailoringChangeType = "reorder" | "rewrite" | "keyword" | "cut";

export interface TailoringSuggestion {
  id: string;
  section: string;
  changeType: TailoringChangeType;
  currentText: string;
  proposedText: string;
  /** One line tying this change to a specific strength or concern from the target opportunity's fit analysis. */
  rationale: string;
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
  /** Present only where the signal behind this gap is honestly thin, shown as a distinct caveat. */
  uncertaintyNote?: string;
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
// Connected sources (simulated) and evidence
// ---------------------------------------------------------------------------

/** Extensible: a future source adds a new type here. */
export type ConnectedSourceType = "email" | "meetingNotes";

export type ConnectedSourceStatus = "connected" | "not-connected" | "needs-attention";

export interface ConnectedSource {
  id: string;
  type: ConnectedSourceType;
  /** Display name shown on its tool card and every evidence chip: "Gmail", "Outlook", "Granola". */
  name: string;
  /** Human label for the source type, "Email" or "Meeting notes", used in secondary copy. */
  category: string;
  status: ConnectedSourceStatus;
  /** Present only once status is "connected". */
  lastSyncedMinutesAgo?: number;
  /** What OpenPath reads, plain language, shown on the tool card and connect dialog step 1. */
  readsDescription: string;
  /** What connecting this source unlocks, specific product value, shown on the tool card and connect dialog step 2. */
  unlocksDescription: string;
}

/** What kind of object a piece of source evidence is suggested to belong to. */
export type SourceEvidenceMapsToType = "opportunity" | "trackRecord" | "goal";

interface SourceEvidenceBase {
  id: string;
  sourceId: string;
  timestamp: string;
  /** Minutes since this item arrived, used to sort the synced-context inbox newest first without parsing the display timestamp. */
  freshnessMinutesAgo: number;
  extract: string;
  mapsToType: SourceEvidenceMapsToType;
  /** Empty when mapsToType is "trackRecord" and no candidate exists yet: linking creates one. */
  mapsToId: string;
  mapsToLabel: string;
  /** Present only when the suggested target is a guess worth naming honestly, "Looks related to Meridian Labs". */
  hedge?: string;
  /** One-line extracted signal, what the system noticed in this item. */
  signal: string;
  /** One quiet line on why this item matters. */
  whyItMatters: string;
  /** One honest line on what the system may use this item for next. */
  usesNext: string;
}

/**
 * One seeded email extract behind an AI proposal or an inbox item: sender,
 * subject, timestamp, a short extract, and the opportunity, Track Record
 * candidate, or goal it maps to. Every AI proposal or inbox row that cites
 * this shows it as an EvidenceChip plus an expandable EvidenceExtract, never
 * hidden grounding.
 */
export interface EmailEvidence extends SourceEvidenceBase {
  kind: "email";
  sender: string;
  subject: string;
}

/** One seeded Granola meeting-note extract, the same evidence shape as an email but from a call or debrief. */
export interface MeetingNoteEvidence extends SourceEvidenceBase {
  kind: "meetingNotes";
  /** Who the note is with, "Prep call with Linh Vu", shown in place of a sender. */
  withWhom: string;
  /** The meeting title, shown in place of a subject line. */
  title: string;
}

export type SourceEvidence = EmailEvidence | MeetingNoteEvidence;

// ---------------------------------------------------------------------------
// Synced-context inbox: source-to-object linking (the workflow /sources adds
// on top of the ticket 17 connected-sources and evidence model above)
// ---------------------------------------------------------------------------

export type InboxItemStatus = "needs-review" | "linked" | "dismissed";

export interface InboxLinkTarget {
  type: SourceEvidenceMapsToType;
  id: string;
  label: string;
}

/** What the user chose in the Link action or the target picker. Track Record never links to an existing entry, it always creates a fresh candidate. */
export type InboxLinkChoice =
  | { type: "opportunity"; id: string; label: string }
  | { type: "goal"; id: string; label: string }
  | { type: "trackRecord" };

/** Runtime link state for one inbox item, keyed by its evidence id in the store. Absent means "needs-review". */
export interface InboxItemLink {
  status: InboxItemStatus;
  linkedTarget?: InboxLinkTarget;
  /** Set when linking logged a fresh Activity moment, so Undo can remove exactly that moment. */
  activityMomentId?: string;
  /** Set when linking created a fresh Track Record candidate, so Undo can remove exactly that entry. */
  createdTrackRecordEntryId?: string;
}

// ---------------------------------------------------------------------------
// AI signal (the five-beat proposal pattern behind components/ai/)
// ---------------------------------------------------------------------------

export type AiSignalState = "proposed" | "approved" | "dismissed";

/** Which icon AiActionCard renders for the signal line, resolved by the connected component in components/ai/signal-card.tsx. */
export type AiSignalIconKind = "email" | "status" | "urgency" | "draft";

interface AiSignalBase {
  id: string;
  opportunityId: string;
  iconKind: AiSignalIconKind;
  /** Beat 1: what the system noticed, one line. */
  signal: string;
  /** Beat 2: one line on why it matters. */
  whyItMatters: string;
  /** Beat 3: the id of the EmailEvidence backing this proposal. */
  evidenceId: string;
  /** Beat 4: the concrete change, stated as what will happen if you accept. */
  proposedAction: string;
  state: AiSignalState;
  /** Set on approve so Undo can remove exactly the Activity moment this signal logged; cleared again on undo. */
  appliedActivityMomentId?: string;
}

/** Accepting updates an existing next action's verb and rationale in place. */
export interface NextActionSignal extends AiSignalBase {
  kind: "next-action";
  nextActionId: string;
  newVerb: string;
  newRationale: string;
  previousVerb: string;
  previousRationale: string;
}

/** Accepting moves the opportunity's status; the board reflects it immediately. */
export interface StatusChangeSignal extends AiSignalBase {
  kind: "status-change";
  newStatus: OpportunityStatus;
  previousStatus: OpportunityStatus;
}

/** Accepting bumps priority and adds a fresh prep next action. */
export interface PriorityBumpSignal extends AiSignalBase {
  kind: "priority-bump";
  newPriority: Priority;
  previousPriority: Priority;
  addedNextAction: NextAction;
}

/** Accepting sends the scripted draft and marks the linked next action done. */
export interface DraftReplySignal extends AiSignalBase {
  kind: "draft-reply";
  nextActionId: string;
  draftText: string;
  previousNextActionState: NextActionState;
}

export type AiSignal = NextActionSignal | StatusChangeSignal | PriorityBumpSignal | DraftReplySignal;

// ---------------------------------------------------------------------------
// Nudge / Weekly Review
// ---------------------------------------------------------------------------

/**
 * The six triggers the attention queue seeds from, grouped into four
 * families by lib/nudge-utils.ts's NUDGE_FAMILY map (opportunity, capture,
 * goal, learning). "weekly-focus" is a seventh trigger reserved for items
 * promoted from an accepted Weekly Review suggestion, pinned on top of the
 * seeded set rather than counted toward the four families.
 */
export type NudgeTrigger =
  | "stale-opportunity"
  | "high-potential"
  | "missing-next-step"
  | "capture-prompt"
  | "goal-reminder"
  | "learning-nudge"
  | "weekly-focus";

export type NudgeState = "active" | "dismissed" | "snoozed";

/** One deep link out of a Nudge card, always into a real workflow, never a dead end. */
export interface NudgeAction {
  label: string;
  href: string;
}

export interface Nudge {
  id: string;
  trigger: NudgeTrigger;
  /** The proactive message itself, referencing the specific object it's about. */
  message: string;
  /** One line on why this surfaced now. */
  why: string;
  /** 1 or 2 deep links into the right workflow. */
  actions: NudgeAction[];
  relatedOpportunityId?: string;
  relatedGoalId?: string;
  relatedLearningItemId?: string;
  state: NudgeState;
  /** Set on items promoted from an accepted Weekly Review focus suggestion; pinned items float to the top of the attention queue. */
  pinned?: boolean;
}

export type WeeklyReviewSuggestionState = "suggested" | "accepted" | "dismissed";

/**
 * One toggleable focus suggestion in Weekly Review step 4. Accepting it
 * (state "accepted") pins a matching Nudge into the Home attention queue via
 * the action's own label and href; toggling back off removes it again.
 */
export interface WeeklyReviewSuggestion {
  id: string;
  text: string;
  state: WeeklyReviewSuggestionState;
  actionLabel: string;
  actionHref: string;
}

/** One "what Copilot noticed" observation in Weekly Review step 2: the observation plus why it matters. */
export interface WeeklyReviewObservation {
  id: string;
  text: string;
  why: string;
}

export interface WeeklyReviewScript {
  /** Step 1: this week's changes, status moves, new opportunities, and actions done, as a compact recap list. */
  whatMoved: string[];
  /** Step 1: one line recapping activity from connected sources, emails scanned and threads linked. */
  connectedSourcesRecap: string;
  /** Step 2: 3 observations with a why line each. */
  observations: WeeklyReviewObservation[];
  /** Step 4: 3 toggleable focus suggestions. */
  suggestedFocus: WeeklyReviewSuggestion[];
}

// ---------------------------------------------------------------------------
// Copilot
// ---------------------------------------------------------------------------

/** One labeled point inside a structured Copilot answer, never a long paragraph. */
export interface CopilotResponsePoint {
  label: string;
  detail: string;
}

/**
 * The three kinds of store-wired action a scripted answer can end with. Each
 * carries the id of a real seed object already known to the store, except
 * "create-candidate-entry", which carries the full drafted entry since the
 * candidate does not exist in the store yet when Copilot proposes it.
 */
export type CopilotSuggestedAction =
  | { kind: "accept-next-action"; targetId: string; label: string }
  | { kind: "add-learning-item"; targetId: string; label: string }
  | { kind: "create-candidate-entry"; entryId: string; label: string };

/**
 * Where a scripted answer hands off to next. "opportunity-tab" resolves
 * against whichever opportunity is currently the panel's object (by role and
 * company), so one scripted line works for both the seeded per-opportunity
 * scripts and any opportunity added later at runtime. "route" is a plain,
 * fixed destination.
 */
export type CopilotHandoff =
  | { kind: "route"; href: string; label: string }
  | {
      kind: "opportunity-tab";
      tab: "overview" | "ai-analysis" | "actions" | "materials" | "activity";
      label: string;
    };

/**
 * The anatomy every scripted answer renders as: a short lead line, optional
 * labeled points, a confidence chip only where a judgment is made, and
 * exactly one of a store-wired action or a handoff, never both.
 */
export interface CopilotResponse {
  lead: string;
  points?: CopilotResponsePoint[];
  confidence?: ConfidenceLevel;
  action?: CopilotSuggestedAction;
  handoff?: CopilotHandoff;
}

export interface CopilotExchange {
  id: string;
  prompt: string;
  response: CopilotResponse;
}

export interface CopilotSurfaceScript {
  surface: string;
  suggestedPrompts: string[];
  exchanges: CopilotExchange[];
}

export interface CopilotMessage {
  id: string;
  role: "user" | "copilot";
  /** Raw user text, or the copilot's plain-text fallback (lead line, or the honest limit-state line). */
  text: string;
  /** Present on copilot messages that matched a scripted exchange, carries the structured render. */
  response?: CopilotResponse;
  createdAt: string;
}
