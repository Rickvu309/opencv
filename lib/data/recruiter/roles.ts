import type { RecruiterRole } from "@/lib/types";

// Recruiter persona: Lan Pham, talent lead at Saola Labs, a fictional HCMC
// product company (the same seed world Mai Tran's opportunities already
// reference: Mekong Robotics, Tidal Finance, and Northwind Robotics all
// share this HCMC-anchored texture). 2 open roles.
// Surface: /recruiter (board's role select), /recruiter/roles.
export const recruiterRoles: RecruiterRole[] = [
  {
    id: "role-spd",
    title: "Senior Product Designer",
    company: "Saola Labs",
    location: "Ho Chi Minh City (hybrid)",
    remote: false,
    seniority: "Senior",
    openedAt: "2026-06-15",
    aboutTheRole:
      "Saola Labs builds an AI-assisted logistics platform for cross-border sellers. This role owns product design for the seller-facing workspace end to end, partnering directly with a 4-person engineering pod and reporting to the Head of Product.",
    mustHaves: [
      "6 or more years of product design experience, with at least one 0-to-1 workspace or platform shipped",
      "Comfortable partnering directly with engineering in a small pod, not a large design org",
      "Portfolio evidence of translating a messy operational problem into a clear, trustworthy interface",
    ],
  },
  {
    id: "role-aie",
    title: "AI Engineer",
    company: "Saola Labs",
    location: "Ho Chi Minh City (hybrid, remote considered for the right candidate)",
    remote: true,
    seniority: "Mid to Senior",
    openedAt: "2026-06-22",
    aboutTheRole:
      "Owns the recommendation and pricing models behind Saola Labs' logistics platform, working alongside the data and product design pods to ship model-backed features end to end, from a first offline prototype through a monitored production rollout.",
    mustHaves: [
      "4 or more years shipping machine learning models to production, not just research prototypes",
      "Direct experience with recommendation or pricing systems",
      "Comfortable working closely with product and design on how a model's output actually reaches the user",
    ],
  },
];
