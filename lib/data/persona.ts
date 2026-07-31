import type { Profile } from "@/lib/types";

// Persona: Mai Tran. All seeded content across the prototype belongs to her.
export const persona: Profile = {
  name: "Mai Tran",
  headline: "Senior Product Designer moving into AI product leadership",
  currentRole: "Senior Product Designer",
  experienceLevel: "Senior (6 to 10 years)",
  location: "Ho Chi Minh City, Vietnam",
  yearsExperience: 7,
  summary:
    "Senior product designer with seven years across fintech, e-commerce, and analytics tools. Spent the last two years designing the AI underwriting assistant at Fintra, and is now aiming for roles that blend AI product design with team leadership. Comfortable owning a problem from messy discovery through to a shipped, measurable outcome.",
  strengths: [
    "Translates ambiguous AI model behavior into clear, trustworthy user flows",
    "Runs discovery research end to end, from screener design to synthesis",
    "Builds and maintains design systems that scale cleanly across squads",
    "Coaches junior designers and facilitates cross-functional critique",
  ],
  strengthEvidence: [
    {
      strength: "Translates ambiguous AI model behavior into clear, trustworthy user flows",
      note: "Directly shown by the AI underwriting explainability panel shipped at Fintra, which cut related support tickets by 22 percent.",
      trackRecordEntryId: "tre-1",
    },
    {
      strength: "Runs discovery research end to end, from screener design to synthesis",
      note: "Evidenced by building Fintra's first structured usability testing program, from screener design through synthesis.",
      trackRecordEntryId: "tre-4",
    },
    {
      strength: "Builds and maintains design systems that scale cleanly across squads",
      note: "Backed by the three-squad design system rollout at Loop Commerce that cut new-screen build time by about 33 percent.",
      trackRecordEntryId: "tre-3",
    },
  ],
  experience: [
    {
      id: "exp-fintra",
      title: "Senior Product Designer",
      company: "Fintra",
      start: "Apr 2023",
      end: "Present",
      bullets: [
        "Led design of the AI underwriting assistant's explainability panel, cutting related support tickets by 22 percent in the first quarter after launch.",
        "Partnered with data science to define the trust-boundary spec that still governs what the assistant can decide on its own.",
      ],
    },
    {
      id: "exp-loop-commerce",
      title: "Product Designer",
      company: "Loop Commerce",
      start: "Jun 2020",
      end: "Mar 2023",
      bullets: [
        "Led the design system rollout across three product squads, cutting new-screen build time by about 33 percent.",
        "Reworked seller-tools checkout and payout flow, cutting related support tickets by 25 percent within two months of launch.",
      ],
    },
    {
      id: "exp-kestrel",
      title: "Product Designer",
      company: "Kestrel Analytics",
      start: "Feb 2019",
      end: "May 2020",
      bullets: [
        "Designed operational dashboards for logistics analysts tracking fleet and warehouse throughput.",
        "Established the company's first structured usability testing program, taking sessions from about 1 per quarter to weekly.",
      ],
    },
    {
      id: "exp-bambu",
      title: "UX Designer",
      company: "Bambu Studio",
      start: "Jul 2017",
      end: "Jan 2019",
      bullets: [
        "Delivered agency design work across retail and health clients under senior design mentors.",
        "Shipped mobile and web product experiences end to end, from early concepts through developer handoff.",
      ],
    },
  ],
  preferences: {
    remote: true,
    location: "Ho Chi Minh City, Vietnam (remote-first, open to relocation for the right role)",
    roleTypes: ["Full-time", "Contract-to-hire"],
    compensationNote: "Targeting senior or staff-level product design compensation, open on structure for the right leadership scope.",
    workStyle: "Remote",
    companySize: "No strong preference, prioritizing the work itself",
    salaryFloor: "$115,000 USD base",
    dealBreakers: [],
  },
  targetDirection:
    "Move from senior individual-contributor product design into AI product design and product leadership, ideally at a company building AI-native tools.",
  targetDirectionLabel: "AI product design and leadership",
  nearTermPriority: "Be selective, only pursue strong-fit roles",
};
