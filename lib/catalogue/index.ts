// Supporting, not an artefact. Role archetypes and the Requirement type Search
// and the catalogue scorer share. There is no Catalogue screen.

export type {
  PathEdge,
  PathNode,
  Requirement,
  Stage,
  StageId,
} from "./graph";
export { pathNodes, stages } from "./graph";
export type { Fit, FitProfile, RequirementMatch } from "./fit";
export { fitFor, matchRequirements, rankByFit } from "./fit";
