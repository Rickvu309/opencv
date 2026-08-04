// Mock data for the OpenPath prototype — one persona across every screen.

export type SkillLevel = {
  name: string;
  current: number; // 0–100
  target: number; // 0–100
  note?: string;
};

export type Opportunity = {
  id: string;
  title: string;
  tagline: string;
  matchScore: number; // 0–100
  potential: number; // 0–100 — tiềm năng thị trường
  feasibility: number; // 0–100 — tính khả thi với hồ sơ hiện tại
  priority: "Cao" | "Trung bình" | "Thấp";
  salaryRange: string;
  demandTrend: string;
  whyFit: string[];
  skills: SkillLevel[];
  timeToReady: string;
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  type: "Khoá học" | "Dự án" | "Kỹ năng" | "Networking" | "Chứng chỉ";
  effort: string;
  done: boolean;
  resource?: { name: string; provider: string };
};

export type ActionPhase = {
  id: string;
  label: string;
  period: string;
  goal: string;
  items: ActionItem[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  content: string;
  suggestion?: {
    kind: "add-opportunity" | "adjust-map";
    label: string;
  };
};

export const user = {
  name: "Trần Minh Anh",
  initials: "MA",
  birthYear: 2004,
  gender: "Nữ",
  school: "Đại học Kinh tế Quốc dân",
  major: "Hệ thống thông tin quản lý",
  year: "Năm 3",
  gpa: "3.4/4.0",
  email: "minhanh.tran@st.neu.edu.vn",
  targetRole: "Data Analyst",
  courses: [
    "Google Data Analytics (Coursera)",
    "SQL for Data Science (DataCamp)",
    "IELTS 6.5",
  ],
  experience: [
    {
      title: "Thực tập sinh Marketing",
      org: "Công ty TNHH Beta Media",
      period: "06/2025 – 09/2025",
      detail: "Phân tích số liệu chiến dịch, làm báo cáo tuần bằng Excel & Looker Studio.",
    },
    {
      title: "Trưởng ban Truyền thông",
      org: "CLB Tin học Kinh tế",
      period: "2024 – nay",
      detail: "Quản lý nhóm 8 người, lên kế hoạch nội dung và đo lường hiệu quả kênh.",
    },
  ],
};

/** A resolvable weakness: fill the matching vault slot and the coach's read updates. */
export type ProfileWeakness = {
  title: string;
  detail: string;
  resolvedBy?: VaultItemId;
  resolvedNote?: string;
};

export const profileSnapshot: {
  summary: string;
  strengths: { title: string; detail: string }[];
  weaknesses: ProfileWeakness[];
  quickWins: string[];
} = {
  summary:
    "Sinh viên năm 3 ngành Hệ thống thông tin quản lý, nền tảng phân tích tốt, đã có kinh nghiệm thực tế với dữ liệu ở mức cơ bản. Phù hợp với nhóm nghề phân tích — cần củng cố kỹ năng kỹ thuật và portfolio để sẵn sàng ứng tuyển.",
  strengths: [
    { title: "Tư duy phân tích", detail: "GPA tốt ở các môn định lượng, quen làm việc với số liệu thực tế từ kỳ thực tập." },
    { title: "Giao tiếp & làm việc nhóm", detail: "Dẫn dắt nhóm 8 người ở CLB, trình bày báo cáo cho quản lý khi thực tập." },
    { title: "Chủ động học", detail: "Tự hoàn thành 2 khoá online về data trong 6 tháng gần nhất." },
  ],
  weaknesses: [
    { title: "SQL mới ở mức cơ bản", detail: "Chưa xử lý được join phức tạp và window functions — kỹ năng bắt buộc khi phỏng vấn." },
    {
      title: "Chưa có portfolio dự án",
      detail: "Kiến thức từ khoá học chưa được chứng minh bằng dự án cá nhân công khai.",
      resolvedBy: "portfolio",
      resolvedNote: "Bạn vừa thêm portfolio — đây sẽ là bằng chứng chính khi ứng tuyển.",
    },
    { title: "Python chưa dùng thực tế", detail: "Mới học cú pháp, chưa từng phân tích một bộ dữ liệu hoàn chỉnh." },
  ],
  quickWins: [
    "Đưa số liệu cụ thể vào CV (ví dụ: “báo cáo tuần cho chiến dịch ngân sách 200 triệu”)",
    "Hoàn thiện trang LinkedIn: ảnh, headline theo hướng Data, mô tả kỳ thực tập",
    "Đăng ký 1 cuộc thi phân tích dữ liệu cho sinh viên trong quý này",
  ],
};

/** Current situation — what keeps the coach's advice specific instead of generic. */
export const careerContext = [
  { label: "Mục tiêu", value: "Data Analyst fresher trước 12/2026" },
  { label: "Thời gian đầu tư", value: "~10h/tuần ngoài giờ học" },
  { label: "Địa điểm", value: "Hà Nội · sẵn sàng hybrid" },
  { label: "Có thể thực tập", value: "Từ 06/2026 (hè năm 3)" },
];

export type VaultItemId =
  | "cv"
  | "cover-letter"
  | "linkedin"
  | "portfolio"
  | "github";

/** A vault slot: filled means the coach can read it, empty is an invitation. */
export type VaultItem = {
  id: VaultItemId;
  title: string;
  /** Contribution to the profile completeness score. */
  weight: number;
  done: boolean;
  /** When filled */
  meta?: string;
  coachNote?: string;
  coachPrompt?: string;
  /** When empty */
  benefit?: string;
  addLabel?: string;
  /** The coach's response the moment it is added. */
  addedNote?: string;
};

/**
 * Experience 14 + education 10 + certificates 8 + context 14 — the parts already
 * in the profile; plus the vault below, totalling 100.
 */
export const profileBaseScore = 46;

export const vaultItems: VaultItem[] = [
  {
    id: "cv",
    title: "CV",
    weight: 18,
    done: true,
    meta: "DataAnalyst_TranMinhAnh.pdf · 2 trang · cập nhật 2 ngày trước",
    coachNote: "Mô tả kỳ thực tập còn thiếu số liệu — mình có 3 gợi ý cụ thể.",
    coachPrompt: "Review giúp mình CV hiện tại",
  },
  {
    id: "portfolio",
    title: "Portfolio dự án",
    weight: 12,
    done: false,
    benefit: "Bằng chứng mạnh nhất của fresher — một dự án phân tích trọn vẹn là đủ.",
    addLabel: "Thêm dự án",
    addedNote: "Đã ghi nhận. Coach sẽ gợi ý cách kể chuyện dự án này trong CV.",
  },
  {
    id: "cover-letter",
    title: "Thư ứng tuyển",
    weight: 10,
    done: false,
    benefit: "Coach viết bản nháp đầu tiên từ chính CV và mục tiêu của bạn.",
    addLabel: "Nhờ coach viết",
    addedNote: "Coach đang soạn bản nháp từ CV của bạn — mở Coach để xem.",
  },
  {
    id: "linkedin",
    title: "LinkedIn",
    weight: 8,
    done: false,
    benefit: "Để coach đối chiếu hồ sơ với tin tuyển dụng Data thật trên thị trường.",
    addLabel: "Liên kết",
    addedNote: "Đã liên kết. Coach sẽ đối chiếu với tin tuyển dụng Data mỗi tuần.",
  },
  {
    id: "github",
    title: "GitHub",
    weight: 6,
    done: false,
    benefit: "Nơi lưu code SQL/Python của dự án — nhà tuyển dụng kỹ tính sẽ tìm nó.",
    addLabel: "Liên kết",
    addedNote: "Đã liên kết. Coach sẽ nhắc bạn đưa repo vào CV và portfolio.",
  },
];

export const opportunities: Opportunity[] = [
  {
    id: "data-analyst",
    title: "Data Analyst",
    tagline: "Biến dữ liệu thành quyết định kinh doanh",
    matchScore: 87,
    potential: 90,
    feasibility: 82,
    priority: "Cao",
    salaryRange: "12–18 triệu (fresher)",
    demandTrend: "Tuyển dụng tăng ~25%/năm tại VN, đặc biệt ở fintech và e-commerce.",
    whyFit: [
      "Ngành học sát với nghề, nền tảng định lượng tốt",
      "Đã có trải nghiệm phân tích số liệu thật khi thực tập",
      "Kỹ năng trình bày tốt — lợi thế lớn khi báo cáo insight",
    ],
    skills: [
      { name: "SQL", current: 40, target: 85, note: "Join nâng cao, window functions" },
      { name: "Excel / Sheets", current: 75, target: 85 },
      { name: "Data Visualization", current: 50, target: 80, note: "Power BI hoặc Looker" },
      { name: "Python (pandas)", current: 25, target: 70 },
      { name: "Business Thinking", current: 65, target: 80 },
      { name: "Storytelling với dữ liệu", current: 55, target: 80 },
    ],
    timeToReady: "6–9 tháng",
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    tagline: "Cầu nối giữa kinh doanh và công nghệ",
    matchScore: 81,
    potential: 82,
    feasibility: 85,
    priority: "Cao",
    salaryRange: "11–16 triệu (fresher)",
    demandTrend: "Nhu cầu ổn định ở các công ty phần mềm và ngân hàng số.",
    whyFit: [
      "Chuyên ngành HTTT quản lý là nền chuẩn cho BA",
      "Giao tiếp và viết tài liệu tốt",
      "Ít yêu cầu kỹ thuật sâu hơn Data Analyst",
    ],
    skills: [
      { name: "Phân tích nghiệp vụ", current: 55, target: 85 },
      { name: "Viết tài liệu (BRD/URD)", current: 35, target: 80 },
      { name: "SQL", current: 40, target: 65 },
      { name: "Giao tiếp với stakeholder", current: 70, target: 85 },
      { name: "Công cụ (Jira, Figma)", current: 30, target: 70 },
    ],
    timeToReady: "4–6 tháng",
  },
  {
    id: "product-owner",
    title: "Associate Product Owner",
    tagline: "Định hình sản phẩm từ nhu cầu người dùng",
    matchScore: 68,
    potential: 85,
    feasibility: 55,
    priority: "Trung bình",
    salaryRange: "13–18 triệu (junior)",
    demandTrend: "Cạnh tranh cao — các công ty thường ưu tiên người có 1–2 năm kinh nghiệm.",
    whyFit: [
      "Kỹ năng dẫn dắt nhóm từ hoạt động CLB",
      "Hiểu cả kinh doanh lẫn công nghệ",
    ],
    skills: [
      { name: "Product Sense", current: 35, target: 80 },
      { name: "User Research", current: 25, target: 70 },
      { name: "Agile / Scrum", current: 30, target: 75 },
      { name: "Data-driven decision", current: 50, target: 80 },
    ],
    timeToReady: "12–18 tháng",
  },
  {
    id: "digital-marketing",
    title: "Digital Marketing (Performance)",
    tagline: "Tối ưu tăng trưởng bằng quảng cáo số",
    matchScore: 62,
    potential: 70,
    feasibility: 75,
    priority: "Thấp",
    salaryRange: "10–14 triệu (fresher)",
    demandTrend: "Nguồn cung ứng viên lớn, cạnh tranh về lương ở mức entry.",
    whyFit: [
      "Đã thực tập đúng mảng, có kết quả thực tế",
      "Tận dụng được kỹ năng phân tích số liệu chiến dịch",
    ],
    skills: [
      { name: "Quảng cáo Meta/Google", current: 45, target: 80 },
      { name: "Phân tích chiến dịch", current: 60, target: 80 },
      { name: "Content", current: 55, target: 70 },
      { name: "SEO cơ bản", current: 20, target: 60 },
    ],
    timeToReady: "3–5 tháng",
  },
];

export const selectedOpportunityId = "data-analyst";

export const gapAnalysis = {
  headline: "Bạn đang ở khoảng 58% chặng đường tới vị trí Data Analyst fresher.",
  readiness: 58,
  marketNote:
    "Thị trường VN quý 3/2026: 78% tin tuyển Data Analyst fresher yêu cầu SQL thành thạo, 64% yêu cầu ít nhất 1 công cụ visualization, 41% ưu tiên ứng viên có portfolio công khai.",
  gaps: [
    {
      skill: "SQL nâng cao",
      severity: "Quan trọng nhất",
      detail: "Khoảng cách lớn nhất và xuất hiện trong hầu hết JD. Ưu tiên luyện join phức tạp, CTE, window functions.",
    },
    {
      skill: "Portfolio dự án",
      severity: "Quan trọng",
      detail: "Chưa có dự án công khai nào — nhà tuyển dụng fresher đánh giá chủ yếu qua portfolio.",
    },
    {
      skill: "Python (pandas)",
      severity: "Nên có",
      detail: "Không bắt buộc ở mọi JD nhưng là lợi thế rõ rệt khi cạnh tranh vòng CV.",
    },
  ],
};

export const actionPlan: ActionPhase[] = [
  {
    id: "phase-1",
    label: "Giai đoạn 1 — Nền tảng",
    period: "Tháng 1–3",
    goal: "SQL vững + công cụ visualization đầu tiên",
    items: [
      {
        id: "a1",
        title: "Hoàn thành khoá SQL trung cấp",
        description: "Tập trung join nâng cao, CTE, window functions. Luyện 50 bài trên nền tảng thực hành.",
        type: "Khoá học",
        effort: "5h/tuần · 8 tuần",
        done: true,
        resource: { name: "Intermediate SQL", provider: "DataCamp" },
      },
      {
        id: "a2",
        title: "Học Power BI từ số 0",
        description: "Dựng dashboard đầu tiên từ dữ liệu bán hàng mẫu, publish công khai.",
        type: "Khoá học",
        effort: "4h/tuần · 6 tuần",
        done: false,
        resource: { name: "Power BI Essentials", provider: "Microsoft Learn" },
      },
      {
        id: "a3",
        title: "Luyện SQL mỗi ngày",
        description: "20 phút/ngày trên LeetCode Database hoặc StrataScratch, mục tiêu 100 bài.",
        type: "Kỹ năng",
        effort: "20ph/ngày",
        done: false,
      },
    ],
  },
  {
    id: "phase-2",
    label: "Giai đoạn 2 — Portfolio",
    period: "Tháng 4–6",
    goal: "2 dự án phân tích hoàn chỉnh, công khai trên GitHub",
    items: [
      {
        id: "b1",
        title: "Dự án #1: Phân tích dữ liệu e-commerce",
        description: "Từ đặt câu hỏi kinh doanh → làm sạch dữ liệu → dashboard → viết insight. Đăng lên GitHub + LinkedIn.",
        type: "Dự án",
        effort: "3 tuần",
        done: false,
      },
      {
        id: "b2",
        title: "Dự án #2: Chủ đề tự chọn theo sở thích",
        description: "Chọn bộ dữ liệu bạn thực sự tò mò (âm nhạc, thể thao, F&B) để kể một câu chuyện dữ liệu.",
        type: "Dự án",
        effort: "3 tuần",
        done: false,
      },
      {
        id: "b3",
        title: "Python cho phân tích dữ liệu",
        description: "pandas, matplotlib — đủ để làm sạch và khám phá dữ liệu trong dự án #2.",
        type: "Khoá học",
        effort: "4h/tuần · 8 tuần",
        done: false,
        resource: { name: "Data Analysis with Python", provider: "freeCodeCamp" },
      },
    ],
  },
  {
    id: "phase-3",
    label: "Giai đoạn 3 — Ứng tuyển",
    period: "Tháng 7–9",
    goal: "Phỏng vấn thật và nhận offer đầu tiên",
    items: [
      {
        id: "c1",
        title: "Chuẩn hoá CV & LinkedIn theo hướng Data",
        description: "CV 1 trang, mỗi gạch đầu dòng có số liệu. Headline LinkedIn: “Aspiring Data Analyst”.",
        type: "Kỹ năng",
        effort: "1 tuần",
        done: false,
      },
      {
        id: "c2",
        title: "Kết nối 20 người đang làm Data tại VN",
        description: "Nhắn tin hỏi kinh nghiệm 5 người/tuần trên LinkedIn — mục tiêu 2 buổi coffee chat.",
        type: "Networking",
        effort: "2h/tuần",
        done: false,
      },
      {
        id: "c3",
        title: "Ứng tuyển 30 vị trí + luyện phỏng vấn",
        description: "Ưu tiên chương trình fresher của fintech/e-commerce. Luyện case SQL và trình bày dự án portfolio.",
        type: "Kỹ năng",
        effort: "4h/tuần",
        done: false,
      },
    ],
  },
];

export const chatSeed: ChatMessage[] = [
  {
    id: "m1",
    role: "coach",
    content:
      "Chào Minh Anh 👋 Mình đã xem lại tiến độ tuần này: bạn hoàn thành khoá SQL trung cấp rồi — đúng kế hoạch. Bạn đang băn khoăn điều gì về hướng đi hiện tại không?",
  },
  {
    id: "m2",
    role: "user",
    content: "Dạo này mình thấy nhiều người nói AI sẽ thay thế Data Analyst. Mình có nên đổi hướng sang AI Engineer không?",
  },
  {
    id: "m3",
    role: "coach",
    content:
      "Câu hỏi rất đáng hỏi — và đây là lúc nên nhìn vào dữ liệu thay vì trend. Ba điểm chính:\n\n1. Nhu cầu Data Analyst tại VN vẫn tăng ~25%/năm; AI đang thay đổi *cách làm việc* của DA (bớt viết query tay, thêm diễn giải insight) chứ chưa thay thế vai trò.\n\n2. AI Engineer yêu cầu nền tảng CS sâu (toán, ML, hệ thống) — với hồ sơ hiện tại bạn sẽ cần 2–3 năm học lại, trong khi bạn chỉ còn cách mục tiêu DA khoảng 6–9 tháng.\n\n3. Hướng đi thông minh hơn: giữ lộ trình DA, nhưng thêm kỹ năng dùng AI trong phân tích. Đó chính là profile “AI-augmented Analyst” mà thị trường đang trả giá cao.\n\nNếu bạn muốn, mình có thể thêm “Analytics Engineer” vào danh sách cơ hội — một hướng phát triển dài hạn rất tự nhiên từ DA.",
    suggestion: {
      kind: "add-opportunity",
      label: "Thêm “Analytics Engineer” vào cơ hội tiềm năng",
    },
  },
];

/** Todo items come from three sources: the plan, coach suggestions, or the user. */
export type TodoSource = "plan" | "coach" | "self";

export type Todo = {
  id: string;
  title: string;
  detail?: string;
  source: TodoSource;
  /** Plan phase, when the task came from there. */
  phase?: string;
  effort?: string;
  resource?: { name: string; provider: string };
  done: boolean;
};

export const sourceLabels: Record<TodoSource, string> = {
  plan: "Kế hoạch",
  coach: "Coach",
  self: "Bạn thêm",
};

/** Tasks the coach suggested in conversation, not yet part of the formal plan. */
export const coachTodos: Todo[] = [
  {
    id: "coach-1",
    title: "Nhắn 5 người đang làm Data trên LinkedIn",
    detail:
      "Coach đề xuất sau buổi trò chuyện về networking: mỗi tuần 5 người, hỏi đúng một câu cụ thể về công việc của họ.",
    source: "coach",
    effort: "30ph/tuần",
    done: false,
  },
  {
    id: "coach-2",
    title: "Viết lại mô tả kỳ thực tập trong CV",
    detail:
      "Thêm quy mô và kết quả: “phân tích số liệu cho chiến dịch ngân sách ~200 triệu/tháng, giúp team điều chỉnh phân bổ kênh”.",
    source: "coach",
    effort: "45 phút",
    done: false,
  },
];

export type Conversation = {
  id: string;
  title: string;
  /** Short relative time, shown right-aligned in the history row. */
  when: string;
  /** Day bucket in the history list. */
  group: string;
};

export const conversations: Conversation[] = [
  { id: "c1", title: "AI có thay thế Data Analyst không?", when: "2 giờ", group: "Hôm nay" },
  { id: "c2", title: "Review mô tả kỳ thực tập trong CV", when: "1 ngày", group: "Hôm qua" },
  { id: "c3", title: "Nên học SQL hay Python trước?", when: "3 ngày", group: "Tuần trước" },
  { id: "c4", title: "Chuẩn bị gì cho vòng phỏng vấn case", when: "5 ngày", group: "Tuần trước" },
  { id: "c5", title: "So sánh Data Analyst và Business Analyst", when: "6 ngày", group: "Tuần trước" },
  { id: "c6", title: "Có nên học thạc sĩ ngay sau tốt nghiệp?", when: "2 tuần", group: "Cũ hơn" },
];

/** Starter prompts on the empty chat screen. */
export const coachStarters = [
  { prompt: "Mình nên ưu tiên gì trong 2 tuần tới?" },
  { prompt: "So sánh Data Analyst và Business Analyst giúp mình" },
  { prompt: "Review giúp mình mô tả kỳ thực tập trong CV" },
  { prompt: "Thị trường Data ở VN đang cần gì?" },
];
