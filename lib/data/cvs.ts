import type { CvVersion } from "@/lib/types";

// 3 CV versions: Base CV, Product-lead CV, and one tailored version linked
// to an Interview opportunity (Meridian Labs, opp-6).
// Surface: /cvs, /cvs/[id].
export const cvVersions: CvVersion[] = [
  {
    id: "cv-1",
    name: "Base CV",
    kind: "base",
    lastEditedAt: "2026-06-01",
    sections: [
      {
        id: "cv-1-summary",
        title: "Summary",
        content:
          "Senior product designer with nine years across fintech, e-commerce, and analytics tools. Led design for an AI underwriting assistant at Fintra, including the explainability panel applicants see when a decision is made.",
      },
      {
        id: "cv-1-experience",
        title: "Experience",
        content:
          "Fintra: Senior Product Designer, Apr 2023 to present. Loop Commerce: Product Designer, Jun 2020 to Mar 2023. Kestrel Analytics: Product Designer, Feb 2019 to May 2020. Bambu Studio: UX Designer, Jul 2017 to Jan 2019.",
      },
      {
        id: "cv-1-skills",
        title: "Skills",
        content:
          "Interaction design, design systems, user research, prototyping, stakeholder communication, accessibility design.",
      },
    ],
  },
  {
    id: "cv-2",
    name: "Product-lead CV",
    kind: "base",
    lastEditedAt: "2026-05-18",
    sections: [
      {
        id: "cv-2-summary",
        title: "Summary",
        content:
          "Senior product designer moving into design leadership. Mentored two designers into mid-level roles and led a three-squad design system rollout at Loop Commerce. Looking for a first or second people-management role.",
      },
      {
        id: "cv-2-experience",
        title: "Experience",
        content:
          "Fintra: Senior Product Designer, Apr 2023 to present, informal lead for two junior designers. Loop Commerce: Product Designer, Jun 2020 to Mar 2023, led design system rollout across three squads. Kestrel Analytics: Product Designer, Feb 2019 to May 2020.",
      },
      {
        id: "cv-2-leadership",
        title: "Leadership highlights",
        content:
          "Mentored two junior designers to mid-level promotion. Ran weekly critique across two squads. Built the design system contribution model still in use at Loop Commerce.",
      },
    ],
  },
  {
    id: "cv-3",
    name: "Meridian Labs, tailored",
    kind: "tailored",
    opportunityId: "opp-6",
    lastEditedAt: "2026-07-18",
    sections: [
      {
        id: "cv-3-summary",
        title: "Summary",
        content:
          "Senior product designer who has shipped a model-explainability surface in production. At Fintra, designed the panel that shows loan applicants why the AI underwriting assistant reached its decision, the closest direct match to Meridian's evaluation console.",
      },
      {
        id: "cv-3-experience",
        title: "Experience",
        content:
          "Fintra: Senior Product Designer, Apr 2023 to present. Owned the explainability panel for the AI underwriting assistant, including how confidence and contributing factors are surfaced to applicants and reviewers.",
      },
      {
        id: "cv-3-relevant-work",
        title: "Relevant to this role",
        content:
          "Designed confidence and uncertainty indicators reviewers rely on daily. Led discovery sprint that shaped the assistant's trust boundary: the model drafts, a human always confirms.",
      },
    ],
  },
];
