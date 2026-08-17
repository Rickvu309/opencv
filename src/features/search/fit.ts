export type Requirement = { text: string };

export type Fit = {
  met: number;
  total: number;
  items: { text: string; met: boolean }[];
  gap: string[];
};

export function extractRequirements(raw: string): Requirement[] {
  const lines = raw
    .split(/\n/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 8 && l.length < 180);
  const picked = lines.slice(0, 8);
  if (picked.length) return picked.map((text) => ({ text }));
  return raw
    .split(/[.•]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 12)
    .slice(0, 6)
    .map((text) => ({ text }));
}

export function scoreFit(requirements: Requirement[], profileText: string): Fit {
  const items = requirements.map((r) => {
    const tokens = r.text
      .toLowerCase()
      .split(/[^a-z0-9+]+/)
      .filter((t) => t.length > 3);
    const met = tokens.filter((t) => profileText.includes(t)).length >= Math.max(1, Math.ceil(tokens.length * 0.4));
    return { text: r.text, met };
  });
  const met = items.filter((i) => i.met).length;
  const gap = items.filter((i) => !i.met).map((i) => i.text);
  return { met, total: items.length, items, gap };
}
