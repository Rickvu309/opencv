// The career map: where you are, which roles you pass through, where you can end up.
// A directed graph laid out in time columns; not a list of jobs.
//
// Every string here is a pair. This is the densest prose in the product after
// the Coach's own replies: thirteen roles, each with what you would actually do
// and what it takes to get in, plus the condition on every edge. Leaving it in
// one language would mean an English reader gets an English interface wrapped
// around a Vietnamese diagram, which is the half-translated state that reads
// worse than either language alone.
//
// The English is written for the same reader in their other language, not
// translated from the Vietnamese: pay stays in đồng because the market is
// Vietnamese, and role titles stay as the industry says them.

import type { Msg } from "@/lib/i18n/locale";

const m = (vi: string, en: string): Msg => ({ vi, en });

export type StageId = "now" | "entry" | "core" | "growth";

export type Stage = {
  id: StageId;
  label: Msg;
  horizon: Msg;
};

/** Four time columns, the diagram's x-axis is time. */
export const stages: Stage[] = [
  { id: "now", label: m("Bạn hôm nay", "You today"), horizon: m("Hiện tại", "Now") },
  {
    id: "entry",
    label: m("Bước vào nghề", "Getting in"),
    horizon: m("0–12 tháng", "0–12 months"),
  },
  {
    id: "core",
    label: m("Vai trò chính", "Established"),
    horizon: m("1–2 năm", "1–2 years"),
  },
  {
    id: "growth",
    label: m("Đi xa hơn", "Further out"),
    horizon: m("3–5 năm", "3–5 years"),
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
   * Monthly pay band. The market is Vietnamese in both languages, so the
   * currency does not change; only the unit is spelled out. "triệu" is
   * ordinary Vietnamese and opaque English, so the English says the unit.
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
 * outlived it because two things still read it: onboarding, which offers these
 * as goals and scores a live fit against the one you pick, and Fit Scoring,
 * which needs a target with requirements on it to score against at all.
 *
 * The map's own furniture is gone: the edges between roles, the "you today"
 * origin node, and the canvas that drew them. What is left is a catalogue.
 */
export const pathNodes: PathNode[] = [
  {
    id: "intern-da",
    title: "Data Analyst Intern",
    stage: "entry",
    salary: m("3–5 triệu", "3–5M ₫ / month"),
    summary: m(
      "Cửa vào chuẩn nhất cho hướng phân tích dữ liệu.",
      "The most direct way into analytics.",
    ),
    does: [
      m("Viết query lấy số liệu cho các team", "Pull numbers for other teams"),
      m("Dựng dashboard theo yêu cầu có sẵn", "Build dashboards to a spec"),
      m("Kiểm tra chất lượng dữ liệu", "Check data quality"),
    ],
    requires: [
      {
        label: m("SQL join & aggregate", "SQL joins and aggregates"),
        skills: ["sql"],
      },
      {
        label: m("Excel nâng cao", "Confident in Excel"),
        skills: ["excel"],
      },
      {
        label: m("1 dự án phân tích cá nhân", "One analysis project of your own"),
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
    salary: m("4–6 triệu", "4–6M ₫ / month"),
    summary: m(
      "Ít yêu cầu kỹ thuật hơn, nặng về tài liệu và giao tiếp.",
      "Less technical. More documentation and stakeholders.",
    ),
    does: [
      m("Ghi biên bản họp với stakeholder", "Write up stakeholder meetings"),
      m("Viết user story và tài liệu mô tả", "Write user stories and specs"),
      m("Vẽ luồng nghiệp vụ đơn giản", "Map simple business flows"),
    ],
    requires: [
      {
        label: m("Hiểu quy trình nghiệp vụ", "How a business actually runs"),
        skills: ["nghiep vu", "business", "quy trinh", "process"],
      },
      {
        label: m("Viết tài liệu rõ ràng", "Write clearly"),
        skills: ["tai lieu", "document", "bao cao", "report", "writing"],
      },
      {
        label: m("Biết Jira, Figma cơ bản", "Basic Jira and Figma"),
        skills: ["jira", "figma"],
      },
    ],
  },
  {
    id: "intern-mkt",
    title: "Marketing Intern",
    stage: "entry",
    salary: m("3–5 triệu", "3–5M ₫ / month"),
    summary: m(
      "Cửa vào dễ nhất, và là nơi nhiều người gặp dữ liệu lần đầu.",
      "The easiest way in, and where many first meet data.",
    ),
    does: [
      m("Theo dõi hiệu quả chiến dịch", "Track how campaigns perform"),
      m("Làm báo cáo số liệu định kỳ", "Produce regular reporting"),
      m("Phối hợp nội dung và kênh", "Coordinate content across channels"),
    ],
    requires: [
      {
        label: m("Chăm chỉ và chịu khó hỏi", "Willingness to ask, and to keep at it"),
        skills: [],
      },
      {
        label: m("Biết đọc số liệu cơ bản", "Reading basic numbers"),
        skills: ["excel", "so lieu", "data", "bao cao", "report", "thong ke", "statistic"],
      },
    ],
  },

  {
    id: "data-analyst",
    title: "Data Analyst",
    stage: "core",
    salary: m("12–18 triệu", "12–18M ₫ / month"),
    summary: m(
      "Biến dữ liệu thành quyết định kinh doanh.",
      "Turn data into business decisions.",
    ),
    does: [
      m(
        "Tự đặt câu hỏi và tìm câu trả lời trong dữ liệu",
        "Ask your own questions, answer them from the data",
      ),
      m(
        "Dựng và bảo trì hệ dashboard cho một mảng",
        "Own the dashboards for one area",
      ),
      m(
        "Trình bày insight cho quản lý, bảo vệ kết luận",
        "Present findings, and defend them",
      ),
    ],
    requires: [
      {
        label: m("SQL window functions", "SQL window functions"),
        skills: ["sql"],
      },
      {
        label: m("Python cho phân tích", "Python for analysis"),
        skills: ["python"],
      },
      {
        label: m("Kể chuyện bằng số liệu", "Telling a story with numbers"),
        skills: ["dashboard", "power bi", "tableau", "looker", "visuali"],
      },
    ],
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    stage: "core",
    salary: m("11–16 triệu", "11–16M ₫ / month"),
    summary: m(
      "Cầu nối giữa kinh doanh và công nghệ.",
      "The bridge between business and engineering.",
    ),
    does: [
      m(
        "Lấy yêu cầu và chuyển thành đặc tả cho dev",
        "Turn business needs into specs developers can build",
      ),
      m("Chủ trì họp với các bên liên quan", "Run the stakeholder meetings"),
      m("Nghiệm thu tính năng trước khi phát hành", "Sign features off before release"),
    ],
    requires: [
      {
        label: m("Phân tích nghiệp vụ", "Business analysis"),
        skills: ["nghiep vu", "business analy"],
      },
      {
        label: m("Viết BRD/URD", "Writing requirement documents"),
        skills: ["brd", "urd", "user story", "requirement", "tai lieu"],
      },
      {
        label: m("SQL đủ để tự kiểm chứng", "Enough SQL to check things yourself"),
        skills: ["sql"],
      },
    ],
  },
  {
    id: "product-owner",
    title: "Associate Product Owner",
    stage: "core",
    salary: m("13–18 triệu", "13–18M ₫ / month"),
    summary: m(
      "Định hình sản phẩm từ nhu cầu người dùng.",
      "Shape the product around what users need.",
    ),
    does: [
      m("Quản lý backlog và thứ tự ưu tiên", "Own the backlog and its order"),
      m("Quyết định làm gì trước, bỏ gì lại", "Decide what ships first"),
      m("Đo lường tính năng sau khi ra mắt", "Measure features after launch"),
    ],
    requires: [
      {
        label: m("Tư duy sản phẩm", "Product judgement"),
        skills: ["product", "san pham"],
      },
      {
        label: m("Hiểu người dùng", "Real knowledge of your users"),
        skills: ["user research", "nguoi dung", "phong van", "survey", "khao sat"],
      },
      {
        label: m("Kinh nghiệm BA hoặc Data trước đó", "BA or data experience first"),
        skills: [],
      },
    ],
  },
  {
    id: "digital-marketing",
    title: "Digital Marketing",
    stage: "core",
    salary: m("10–14 triệu", "10–14M ₫ / month"),
    summary: m(
      "Tối ưu tăng trưởng bằng quảng cáo số.",
      "Grow the business through paid channels.",
    ),
    does: [
      m("Chạy và tối ưu chiến dịch trả phí", "Run and tune paid campaigns"),
      m("Phân tích phễu chuyển đổi", "Analyse the conversion funnel"),
      m("Quản lý ngân sách theo hiệu quả", "Move budget to what works"),
    ],
    requires: [
      {
        label: m("Google/Meta Ads", "Google and Meta Ads"),
        skills: ["google ads", "meta ads", "facebook ads", "quang cao", "ads"],
      },
      {
        label: m("Đọc số liệu chiến dịch", "Reading campaign data"),
        skills: ["campaign", "chien dich", "marketing"],
      },
      {
        label: m("A/B testing", "A/B testing"),
        skills: ["a/b", "ab test", "thu nghiem", "experiment"],
      },
    ],
  },

  {
    id: "senior-da",
    title: "Senior Data Analyst",
    stage: "growth",
    salary: m("25–35 triệu", "25–35M ₫ / month"),
    summary: m(
      "Dẫn dắt phân tích cho cả một mảng kinh doanh.",
      "Lead analysis for a whole part of the business.",
    ),
    does: [
      m("Định nghĩa chỉ số chuẩn cho công ty", "Define the metrics the company agrees on"),
      m("Hướng dẫn analyst mới", "Mentor newer analysts"),
      m("Làm việc trực tiếp với ban lãnh đạo", "Work directly with leadership"),
    ],
    requires: [
      {
        label: m("2–3 năm làm DA", "2–3 years as an analyst"),
        skills: [],
      },
      {
        label: m("Thống kê vững", "Solid statistics"),
        skills: ["thong ke", "statistic", "xac suat", "probability"],
      },
      {
        label: m("Ảnh hưởng không cần quyền", "Influence without authority"),
        skills: [],
      },
    ],
  },
  {
    id: "analytics-engineer",
    title: "Analytics Engineer",
    stage: "growth",
    salary: m("28–40 triệu", "28–40M ₫ / month"),
    summary: m(
      "Xây nền dữ liệu cho cả tổ chức dùng.",
      "Build the data foundation everyone works on.",
    ),
    does: [
      m("Thiết kế mô hình dữ liệu (dbt, warehouse)", "Design data models (dbt, warehouse)"),
      m("Chuẩn hoá pipeline và định nghĩa chỉ số", "Standardise pipelines and metrics"),
      m("Đưa kỷ luật kỹ thuật vào đội phân tích", "Bring engineering discipline to analytics"),
    ],
    requires: [
      {
        label: m("Python & Git thành thạo", "Fluent Python and Git"),
        skills: ["python", "git"],
      },
      {
        label: m("Mô hình hoá dữ liệu", "Data modelling"),
        skills: ["data model", "mo hinh du lieu", "dbt", "warehouse", "etl"],
      },
      {
        label: m("Hiểu kỹ thuật hệ thống", "Systems knowledge"),
        skills: ["he thong", "system", "api"],
      },
    ],
  },
  {
    id: "product-analyst",
    title: "Product Analyst",
    stage: "growth",
    salary: m("22–32 triệu", "22–32M ₫ / month"),
    summary: m(
      "Phân tích hành vi để định hướng sản phẩm.",
      "Read user behaviour to steer the product.",
    ),
    does: [
      m("Thiết kế và đọc kết quả thử nghiệm", "Design experiments, read the results"),
      m("Phân tích phễu và giữ chân người dùng", "Analyse funnels and retention"),
      m("Ngồi cùng team sản phẩm mỗi ngày", "Sit with the product team day to day"),
    ],
    requires: [
      {
        label: m("Thống kê thử nghiệm", "Experiment statistics"),
        skills: ["thong ke", "statistic", "a/b", "experiment"],
      },
      {
        label: m("Công cụ analytics sản phẩm", "Product analytics tools"),
        skills: ["amplitude", "mixpanel", "ga4", "google analytics"],
      },
      {
        label: m("Tư duy sản phẩm", "Product judgement"),
        skills: ["product", "san pham"],
      },
    ],
  },
  {
    id: "ba-lead",
    title: "Product Owner",
    stage: "growth",
    salary: m("30–45 triệu", "30–45M ₫ / month"),
    summary: m(
      "Chịu trách nhiệm kết quả của một sản phẩm.",
      "Own how a product performs.",
    ),
    does: [
      m("Sở hữu lộ trình sản phẩm", "Own the roadmap"),
      m("Cân đối giữa kinh doanh, kỹ thuật và người dùng", "Balance business, engineering and users"),
      m("Chịu trách nhiệm về chỉ số sản phẩm", "Answer for the product's numbers"),
    ],
    requires: [
      {
        label: m("2–3 năm BA hoặc APO", "2–3 years as a BA or APO"),
        skills: [],
      },
      {
        label: m("Dẫn dắt liên phòng ban", "Leading across teams"),
        skills: [],
      },
      {
        label: m("Ra quyết định có đánh đổi", "Deciding with real trade-offs"),
        skills: [],
      },
    ],
  },
  {
    id: "growth-lead",
    title: "Growth Lead",
    stage: "growth",
    salary: m("25–40 triệu", "25–40M ₫ / month"),
    summary: m(
      "Dẫn dắt tăng trưởng bằng dữ liệu và thử nghiệm.",
      "Drive growth through data and testing.",
    ),
    does: [
      m("Sở hữu chỉ tiêu tăng trưởng", "Own the growth target"),
      m("Điều phối marketing, sản phẩm và dữ liệu", "Coordinate marketing, product and data"),
      m("Xây hệ thống thử nghiệm liên tục", "Keep experiments running continuously"),
    ],
    requires: [
      {
        label: m("Kinh nghiệm performance marketing", "Performance marketing experience"),
        skills: ["performance marketing", "ads", "quang cao"],
      },
      {
        label: m("Đọc dữ liệu tốt", "Strong with data"),
        skills: ["data", "so lieu", "sql", "excel"],
      },
      {
        label: m("Quản lý ngân sách lớn", "Managing a real budget"),
        skills: ["ngan sach", "budget"],
      },
    ],
  },
];


/**
 * Roles the map offers, other than the origin. Used where a list of real
 * destinations is wanted and "you today" would be noise.
 */
