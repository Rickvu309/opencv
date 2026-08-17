// Role catalogue: archetypes with requirements. Not a screen.
//
// Thirteen roles, each with what you would actually do and what it takes to
// get in. Pay stays in đồng because the market is Vietnamese; role titles stay
// as the industry says them.

import type { Msg } from "@/lib/i18n/locale";

const m = (en: string): Msg => en;

export type StageId = "now" | "entry" | "core" | "growth";

export type Stage = {
  id: StageId;
  label: Msg;
  horizon: Msg;
};

/** Four time columns, the diagram's x-axis is time. */
export const stages: Stage[] = [
  { id: "now", label: m("You today"), horizon: m("Now") },
  {
    id: "entry",
    label: m("Getting in"),
    horizon: m("0–12 months"),
  },
  {
    id: "core",
    label: m("Established"),
    horizon: m("1–2 years"),
  },
  {
    id: "growth",
    label: m("Further out"),
    horizon: m("3–5 years"),
  },
];

/**
 * One thing a role asks for, in words and in tokens.
 *
 * Both halves in one object on purpose. The prose is what the map shows; the
 * tokens are what `fitFor` matches a profile against. Kept as two parallel
 * lists they would drift apart the first time somebody edited a requirement
 * and not its keywords, and the number on screen would quietly stop meaning
 * what the sentence beside it says.
 *
 * `skills: []` marks a requirement a profile cannot prove — "willingness to
 * ask", "influence without authority". Those are real requirements and bad
 * evidence, so fit leaves them out of its denominator rather than counting
 * everyone as failing them.
 */
export type Requirement = {
  label: Msg;
  /**
   * Lowercase, unaccented fragments. Matched as substrings against the user's
   * courses, experience and field of study, so "sql" catches "SQL cơ bản" and
   * "Advanced SQL" alike.
   */
  skills: string[];
};

export type PathNode = {
  id: string;
  title: string;
  stage: StageId;
  /**
   * Monthly pay band. The currency stays đồng; the unit is spelled out.
   */
  salary?: Msg;
  summary: Msg;
  /** What you actually have to be able to do in this role. */
  does?: Msg[];
  /** What it takes to step into this role. */
  requires?: Requirement[];
  /** A node the user added, removable. */
  custom?: boolean;
};

export type PathEdge = {
  from: string;
  to: string;
  /** Transition condition, shown on edge hover. */
  via?: Msg;
};

/**
 * The roles OpenPath knows about.
 *
 * This was the career map's dataset. The map is retired (WO-60), and the list
 * outlived it because Fit Scoring needs a target with requirements on it to
 * score against at all.
 *
 * The map's own furniture is gone: the edges between roles, the "you today"
 * origin node, and the canvas that drew them. What is left is a catalogue.
 */
export const pathNodes: PathNode[] = [
  {
    id: "intern-da",
    title: "Data Analyst Intern",
    stage: "entry",
    salary: m("3–5M ₫ / month"),
    summary: m("The most direct way into analytics."),
    does: [
      m("Pull numbers for other teams"),
      m("Build dashboards to a spec"),
      m("Check data quality"),
    ],
    requires: [
      {
        label: m("SQL joins and aggregates"),
        skills: ["sql"],
      },
      {
        label: m("Confident in Excel"),
        skills: ["excel"],
      },
      {
        label: m("One analysis project of your own"),
        // Project words only. "phan tich" alone matched a *degree* in data
        // analysis, so reading "Phân tích dữ liệu" in the field-of-study box
        // ticked "you have built one of your own" — which is the sort of
        // flattery that made the old hardcoded score worthless.
        skills: ["du an", "project", "portfolio", "capstone", "khoa luan"],
      },
    ],
  },
  {
    id: "intern-ba",
    title: "Business Analyst Intern",
    stage: "entry",
    salary: m("4–6M ₫ / month"),
    summary: m("Less technical. More documentation and stakeholders."),
    does: [
      m("Write up stakeholder meetings"),
      m("Write user stories and specs"),
      m("Map simple business flows"),
    ],
    requires: [
      {
        label: m("How a business actually runs"),
        skills: ["nghiep vu", "business", "quy trinh", "process"],
      },
      {
        label: m("Write clearly"),
        skills: ["tai lieu", "document", "bao cao", "report", "writing"],
      },
      {
        label: m("Basic Jira and Figma"),
        skills: ["jira", "figma"],
      },
    ],
  },
  {
    id: "intern-mkt",
    title: "Marketing Intern",
    stage: "entry",
    salary: m("3–5M ₫ / month"),
    summary: m("The easiest way in, and where many first meet data."),
    does: [
      m("Track how campaigns perform"),
      m("Produce regular reporting"),
      m("Coordinate content across channels"),
    ],
    requires: [
      {
        label: m("Willingness to ask, and to keep at it"),
        skills: [],
      },
      {
        label: m("Reading basic numbers"),
        skills: ["excel", "so lieu", "data", "bao cao", "report", "thong ke", "statistic"],
      },
    ],
  },

  {
    id: "data-analyst",
    title: "Data Analyst",
    stage: "core",
    salary: m("12–18M ₫ / month"),
    summary: m("Turn data into business decisions."),
    does: [
      m("Ask your own questions, answer them from the data"),
      m("Own the dashboards for one area"),
      m("Present findings, and defend them"),
    ],
    requires: [
      {
        label: m("SQL window functions"),
        skills: ["sql"],
      },
      {
        label: m("Python for analysis"),
        skills: ["python"],
      },
      {
        label: m("Telling a story with numbers"),
        skills: ["dashboard", "power bi", "tableau", "looker", "visuali"],
      },
    ],
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    stage: "core",
    salary: m("11–16M ₫ / month"),
    summary: m("The bridge between business and engineering."),
    does: [
      m("Turn business needs into specs developers can build"),
      m("Run the stakeholder meetings"),
      m("Sign features off before release"),
    ],
    requires: [
      {
        label: m("Business analysis"),
        skills: ["nghiep vu", "business analy"],
      },
      {
        label: m("Writing requirement documents"),
        skills: ["brd", "urd", "user story", "requirement", "tai lieu"],
      },
      {
        label: m("Enough SQL to check things yourself"),
        skills: ["sql"],
      },
    ],
  },
  {
    id: "product-owner",
    title: "Associate Product Owner",
    stage: "core",
    salary: m("13–18M ₫ / month"),
    summary: m("Shape the product around what users need."),
    does: [
      m("Own the backlog and its order"),
      m("Decide what ships first"),
      m("Measure features after launch"),
    ],
    requires: [
      {
        label: m("Product judgement"),
        skills: ["product", "san pham"],
      },
      {
        label: m("Real knowledge of your users"),
        skills: ["user research", "nguoi dung", "phong van", "survey", "khao sat"],
      },
      {
        label: m("BA or data experience first"),
        skills: [],
      },
    ],
  },
  {
    id: "digital-marketing",
    title: "Digital Marketing",
    stage: "core",
    salary: m("10–14M ₫ / month"),
    summary: m("Grow the business through paid channels."),
    does: [
      m("Run and tune paid campaigns"),
      m("Analyse the conversion funnel"),
      m("Move budget to what works"),
    ],
    requires: [
      {
        label: m("Google and Meta Ads"),
        skills: ["google ads", "meta ads", "facebook ads", "quang cao", "ads"],
      },
      {
        label: m("Reading campaign data"),
        skills: ["campaign", "chien dich", "marketing"],
      },
      {
        label: m("A/B testing"),
        skills: ["a/b", "ab test", "thu nghiem", "experiment"],
      },
    ],
  },

  {
    id: "senior-da",
    title: "Senior Data Analyst",
    stage: "growth",
    salary: m("25–35M ₫ / month"),
    summary: m("Lead analysis for a whole part of the business."),
    does: [
      m("Define the metrics the company agrees on"),
      m("Mentor newer analysts"),
      m("Work directly with leadership"),
    ],
    requires: [
      {
        label: m("2–3 years as an analyst"),
        skills: [],
      },
      {
        label: m("Solid statistics"),
        skills: ["thong ke", "statistic", "xac suat", "probability"],
      },
      {
        label: m("Influence without authority"),
        skills: [],
      },
    ],
  },
  {
    id: "analytics-engineer",
    title: "Analytics Engineer",
    stage: "growth",
    salary: m("28–40M ₫ / month"),
    summary: m("Build the data foundation everyone works on."),
    does: [
      m("Design data models (dbt, warehouse)"),
      m("Standardise pipelines and metrics"),
      m("Bring engineering discipline to analytics"),
    ],
    requires: [
      {
        label: m("Fluent Python and Git"),
        skills: ["python", "git"],
      },
      {
        label: m("Data modelling"),
        skills: ["data model", "mo hinh du lieu", "dbt", "warehouse", "etl"],
      },
      {
        label: m("Systems knowledge"),
        skills: ["he thong", "system", "api"],
      },
    ],
  },
  {
    id: "product-analyst",
    title: "Product Analyst",
    stage: "growth",
    salary: m("22–32M ₫ / month"),
    summary: m("Read user behaviour to steer the product."),
    does: [
      m("Design experiments, read the results"),
      m("Analyse funnels and retention"),
      m("Sit with the product team day to day"),
    ],
    requires: [
      {
        label: m("Experiment statistics"),
        skills: ["thong ke", "statistic", "a/b", "experiment"],
      },
      {
        label: m("Product analytics tools"),
        skills: ["amplitude", "mixpanel", "ga4", "google analytics"],
      },
      {
        label: m("Product judgement"),
        skills: ["product", "san pham"],
      },
    ],
  },
  {
    id: "ba-lead",
    title: "Product Owner",
    stage: "growth",
    salary: m("30–45M ₫ / month"),
    summary: m("Own how a product performs."),
    does: [
      m("Own the roadmap"),
      m("Balance business, engineering and users"),
      m("Answer for the product's numbers"),
    ],
    requires: [
      {
        label: m("2–3 years as a BA or APO"),
        skills: [],
      },
      {
        label: m("Leading across teams"),
        skills: [],
      },
      {
        label: m("Deciding with real trade-offs"),
        skills: [],
      },
    ],
  },
  {
    id: "growth-lead",
    title: "Growth Lead",
    stage: "growth",
    salary: m("25–40M ₫ / month"),
    summary: m("Drive growth through data and testing."),
    does: [
      m("Own the growth target"),
      m("Coordinate marketing, product and data"),
      m("Keep experiments running continuously"),
    ],
    requires: [
      {
        label: m("Performance marketing experience"),
        skills: ["performance marketing", "ads", "quang cao"],
      },
      {
        label: m("Strong with data"),
        skills: ["data", "so lieu", "sql", "excel"],
      },
      {
        label: m("Managing a real budget"),
        skills: ["ngan sach", "budget"],
      },
    ],
  },
];
