const blocked = /\b(ignore previous|system prompt|api key)\b/i;
const medicalLegal = /\b(diagnose|lawsuit|tax evasion|prescription)\b/i;

export function checkInput(text: string) {
  if (blocked.test(text)) return "that request tries to override the Coach";
  if (medicalLegal.test(text)) {
    return "I stay with career questions. Legal, medical, and personal-finance advice are out of scope.";
  }
  return null;
}

export function checkOutput(text: string, allowedFacts: string[]) {
  const inventedPercent = /(\d{2,3})\s*%/.exec(text);
  if (inventedPercent) {
    const n = inventedPercent[1];
    if (!allowedFacts.some((f) => f.includes(n))) {
      return "reply invented a number that is not in the profile";
    }
  }
  return null;
}

export function hasExclamation(text: string) {
  return text.includes("!");
}
