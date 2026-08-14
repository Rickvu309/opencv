/**
 * A real job opening, as opposed to a role archetype.
 *
 * ## Where these come from
 *
 * Pasted, mostly. The blueprint's later ambition is a live feed, and this
 * version deliberately does not build one: a scraping pipeline is weeks of work
 * whose failure mode is a stale list nobody trusts. What a student actually
 * does today is find a posting on Facebook or LinkedIn, and the thing they need
 * is to know whether it is worth their afternoon. So the source is a paste box
 * and a small seed set, behind a model a feed can fill later without any
 * consumer changing.
 *
 * ## Why requirements are `Requirement`, the same type the fit calculator uses
 *
 * So Fit Scoring can be pointed at an opening with no new scoring logic. A
 * requirement line the parser cannot tie to a skill gets `skills: []`, which
 * the calculator already treats as unprovable and leaves out of the
 * denominator. That is AC-SEARCH-003.4 falling out of a decision made long
 * before this feature existed, rather than a special case written for it.
 */

import type { Requirement } from "@/lib/career-graph";
import type { Msg } from "@/lib/i18n/locale";

export type Opening = {
  id: string;
  title: string;
  org: string;
  /** The posting, as the user pasted it or as the seed wrote it. */
  description: string;
  requirements: Requirement[];
  location?: string;
  link?: string;
  /** Saved openings are the ones My Applications can act on. */
  saved?: boolean;
  /** Seeded openings are examples; the user's own are not. */
  seeded?: boolean;
  addedAt: number;
};

/** The saved ones, which is what My Applications reads. */
export function savedOpenings(openings: readonly Opening[]): Opening[] {
  return openings.filter((opening) => opening.saved);
}

export function openingById(
  openings: readonly Opening[],
  id: string,
): Opening | undefined {
  return openings.find((opening) => opening.id === id);
}

/**
 * The skill vocabulary a pasted requirement line is read against.
 *
 * Deliberately short and concrete. Every entry is something that can appear in
 * somebody's course list or job title, because that is what the fit calculator
 * matches against; a vocabulary full of "communication" and "teamwork" would
 * produce requirements nobody can evidence and a fit score that means nothing.
 */
export const SKILL_VOCABULARY: Record<string, string[]> = {
  sql: ["sql"],
  python: ["python"],
  r: ["r studio", "rstudio"],
  excel: ["excel", "google sheets", "spreadsheet"],
  "power bi": ["power bi", "powerbi"],
  tableau: ["tableau"],
  looker: ["looker"],
  "google analytics": ["google analytics", "ga4"],
  dashboard: ["dashboard", "báo cáo"],
  etl: ["etl", "airflow", "data pipeline"],
  statistics: ["statistic", "thống kê", "xác suất"],
  "machine learning": ["machine learning", "học máy"],
  figma: ["figma"],
  javascript: ["javascript", "typescript"],
  react: ["react", "next.js", "nextjs"],
  marketing: ["marketing", "seo", "content"],
  english: ["ielts", "toeic", "tiếng anh", "english"],
};

/** The lines of a pasted posting that read like requirements. */
function requirementLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*·–]\s*/, "").trim())
    .filter((line) => line.length > 2);

  // A posting usually has a requirements heading. When it does, take what
  // follows it; when it does not, take the bulleted lines, which is what a
  // requirements list looks like without a heading.
  const heading = lines.findIndex((line) =>
    /^(yêu cầu|requirement|qualification|what you.{0,5}ll need|kỹ năng)/i.test(line),
  );
  if (heading >= 0) {
    const after = lines.slice(heading + 1);
    const stop = after.findIndex((line) =>
      /^(quyền lợi|benefit|phúc lợi|about us|liên hệ|how to apply)/i.test(line),
    );
    return (stop >= 0 ? after.slice(0, stop) : after).slice(0, 12);
  }
  return text
    .split(/\r?\n/)
    .filter((line) => /^\s*[-•*·–]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-•*·–]\s*/, "").trim())
    .slice(0, 12);
}

/** The skills a requirement line names, if any. */
function skillsIn(line: string): string[] {
  const haystack = line.toLowerCase();
  return Object.entries(SKILL_VOCABULARY)
    .filter(([, terms]) => terms.some((term) => haystack.includes(term)))
    .map(([skill]) => skill);
}

/**
 * Turn a pasted posting into an `Opening`.
 *
 * Best effort by design. What it cannot work out it leaves blank rather than
 * inventing, and every field it guesses is editable afterwards, because a
 * parser that quietly gets the company wrong is worse than one that asks.
 */
export const MIN_POSTING_CHARS = 20;

export function parseOpening(
  text: string,
  now: number = Date.now(),
): Opening | null {
  const trimmed = text.trim();
  // A real posting has a title and at least one other thing in it. Anything
  // shorter is a stray paste, and turning it into a row the user then has to
  // find and delete is worse than declining it.
  if (trimmed.length < MIN_POSTING_CHARS) return null;

  const link = /https?:\/\/\S+/.exec(trimmed)?.[0];
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // A pasted posting almost always leads with the job title, and often has the
  // company on the next line or after a dash on the first.
  const first = lines[0] ?? "";
  const dashed = first.split(/\s+[-–—|@]\s+/);
  const title = (dashed[0] || "Vị trí").slice(0, 120);
  const org = (dashed[1] ?? lines[1] ?? "").slice(0, 120);

  const requirements: Requirement[] = requirementLines(trimmed).map((line) => ({
    label: { vi: line, en: line } as Msg,
    skills: skillsIn(line),
  }));

  return {
    // Time-based rather than random: two openings added in the same
    // millisecond would be an unusual afternoon.
    id: `opening-${now}-${title.slice(0, 12).replace(/\W+/g, "")}`,
    title,
    org,
    description: trimmed.slice(0, 8_000),
    requirements,
    link,
    addedAt: now,
  };
}

const req = (vi: string, en: string, ...skills: string[]): Requirement => ({
  label: { vi, en },
  skills,
});

/**
 * A few real-shaped openings so the list is not empty on first use.
 *
 * Marked `seeded` so the interface can say what they are. An empty search
 * screen teaches nothing; four examples show what a good posting looks like
 * and what the fit read is for.
 */
export const SEED_OPENINGS: Opening[] = [
  {
    id: "seed-da-intern",
    title: "Data Analyst Intern",
    org: "Công ty phân tích dữ liệu",
    description:
      "Thực tập sinh phân tích dữ liệu, hỗ trợ đội marketing dựng báo cáo tuần và làm sạch dữ liệu bán hàng.",
    requirements: [
      req("SQL cơ bản, truy vấn và join", "Basic SQL, queries and joins", "sql"),
      req("Excel hoặc Google Sheets", "Excel or Google Sheets", "excel"),
      req("Dựng được một dashboard", "Can build a dashboard", "dashboard"),
      req("Ham học và chủ động hỏi", "Curious, asks questions"),
    ],
    location: "Hà Nội",
    seeded: true,
    addedAt: 0,
  },
  {
    id: "seed-ba-junior",
    title: "Junior Business Analyst",
    org: "Công ty phần mềm",
    description:
      "Làm việc với đội sản phẩm để làm rõ yêu cầu, viết tài liệu và theo dõi số liệu sau khi phát hành.",
    requirements: [
      req("SQL để tự kiểm tra số liệu", "SQL to check your own numbers", "sql"),
      req("Excel và trình bày số liệu", "Excel and presenting numbers", "excel"),
      req("Tiếng Anh đọc hiểu tài liệu", "English for reading documents", "english"),
      req("Viết tài liệu rõ ràng", "Writes clearly"),
    ],
    location: "TP. Hồ Chí Minh",
    seeded: true,
    addedAt: 0,
  },
  {
    id: "seed-mkt-analyst",
    title: "Marketing Analyst",
    org: "Chuỗi bán lẻ",
    description:
      "Đo hiệu quả các chiến dịch, dựng báo cáo định kỳ và đề xuất điều chỉnh ngân sách.",
    requirements: [
      req("Google Analytics", "Google Analytics", "google analytics"),
      req("Excel nâng cao", "Advanced Excel", "excel"),
      req("Hiểu chỉ số marketing", "Understands marketing metrics", "marketing"),
      req("Power BI hoặc Tableau", "Power BI or Tableau", "power bi", "tableau"),
    ],
    location: "Hà Nội",
    seeded: true,
    addedAt: 0,
  },
  {
    id: "seed-de-junior",
    title: "Junior Data Engineer",
    org: "Công ty fintech",
    description:
      "Xây và duy trì pipeline dữ liệu, đảm bảo dữ liệu tới kho đúng giờ và đúng số.",
    requirements: [
      req("Python", "Python", "python"),
      req("SQL và tối ưu truy vấn", "SQL and query tuning", "sql"),
      req("Hiểu ETL hoặc Airflow", "Understands ETL or Airflow", "etl"),
      req("Cẩn thận với dữ liệu", "Careful with data"),
    ],
    location: "Hà Nội",
    seeded: true,
    addedAt: 0,
  },
];
