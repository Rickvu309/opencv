import type { Profile } from "@/lib/types";

// Persona: Mai Tran. All seeded content across the prototype belongs to her.
export const persona: Profile = {
  name: "Mai Tran",
  headline: "Senior Product Designer moving into AI product leadership",
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
  experience: [
    {
      id: "exp-fintra",
      title: "Senior Product Designer",
      company: "Fintra",
      start: "Apr 2023",
      end: "Present",
      summary:
        "Leads design for lending and onboarding. Partnered with the data science team to launch the AI underwriting assistant, including the explainability panel that shows applicants why a decision was made.",
    },
    {
      id: "exp-loop-commerce",
      title: "Product Designer",
      company: "Loop Commerce",
      start: "Jun 2020",
      end: "Mar 2023",
      summary:
        "Owned checkout and seller-tools experience for a regional marketplace. Led the design system rollout across three product squads, cutting new-screen build time by roughly a third.",
    },
    {
      id: "exp-kestrel",
      title: "Product Designer",
      company: "Kestrel Analytics",
      start: "Feb 2019",
      end: "May 2020",
      summary:
        "Designed operational dashboards for logistics analysts and ran the company's first structured usability testing program.",
    },
    {
      id: "exp-bambu",
      title: "UX Designer",
      company: "Bambu Studio",
      start: "Jul 2017",
      end: "Jan 2019",
      summary:
        "Agency work across retail and health clients. Shipped mobile and web product experiences end to end under senior design mentors.",
    },
  ],
  preferences: {
    remote: true,
    location: "Ho Chi Minh City, Vietnam (remote-first, open to relocation for the right role)",
    roleTypes: ["Full-time", "Contract-to-hire"],
    compensationNote: "Targeting senior or staff-level product design compensation, open on structure for the right leadership scope.",
  },
  targetDirection:
    "Move from senior individual-contributor product design into AI product design and product leadership, ideally at a company building AI-native tools.",
};
