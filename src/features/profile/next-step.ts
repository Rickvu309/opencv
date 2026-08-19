export type ProfileNextStepId = "facts" | "experience" | "education" | "links" | "cv";

export type ProfileNextStep = {
  id: ProfileNextStepId;
  label: string;
};

export function profileNextStep(input: {
  empty: boolean;
  experienceCount: number;
  factCount: number;
  hasSchool: boolean;
  linkCount: number;
}): ProfileNextStep {
  if (input.empty) return { id: "facts", label: "Add a fact" };
  if (input.experienceCount === 0) return { id: "experience", label: "Add experience" };
  if (input.factCount === 0) return { id: "facts", label: "Add a fact" };
  if (!input.hasSchool) return { id: "education", label: "Add education" };
  if (input.linkCount === 0) return { id: "links", label: "Add a link" };
  return { id: "cv", label: "Start a CV" };
}

export function profileCanStartCv(input: {
  name: string;
  experienceCount: number;
  hasSchool: boolean;
}): boolean {
  return Boolean(input.name) && (input.experienceCount > 0 || input.hasSchool);
}
