// The career map: where you are, which roles you pass through, where you can end up.
// A directed graph laid out in time columns — not a list of jobs.

export type StageId = "now" | "entry" | "core" | "growth";

export type Stage = {
  id: StageId;
  label: string;
  horizon: string;
};

/** Four time columns — the diagram's x-axis is time. */
export const stages: Stage[] = [
  { id: "now", label: "Bạn hôm nay", horizon: "Hiện tại" },
  { id: "entry", label: "Bước vào nghề", horizon: "0–12 tháng" },
  { id: "core", label: "Vai trò chính", horizon: "1–2 năm" },
  { id: "growth", label: "Đi xa hơn", horizon: "3–5 năm" },
];

export type PathNode = {
  id: string;
  title: string;
  stage: StageId;
  /** Fit against the current profile. The "today" node has none. */
  fit?: number;
  salary?: string;
  summary: string;
  /** What you actually have to be able to do in this role. */
  does?: string[];
  /** What it takes to step into this role. */
  requires?: string[];
  /** A node the user added — removable. */
  custom?: boolean;
};

export type PathEdge = {
  from: string;
  to: string;
  /** Transition condition, shown on edge hover. */
  via?: string;
};

export const pathNodes: PathNode[] = [
  {
    id: "you",
    title: "Trần Minh Anh",
    stage: "now",
    summary: "Năm 3 · Hệ thống thông tin quản lý · GPA 3.4",
    does: [
      "SQL cơ bản, Excel & Looker Studio",
      "Đã thực tập marketing 3 tháng, làm báo cáo tuần",
      "Dẫn nhóm 8 người ở CLB",
    ],
  },

  {
    id: "intern-da",
    title: "Thực tập sinh Data",
    stage: "entry",
    fit: 84,
    salary: "3–5 triệu",
    summary: "Cửa vào chuẩn nhất cho hướng phân tích dữ liệu.",
    does: [
      "Viết query lấy số liệu cho các team",
      "Dựng dashboard theo yêu cầu có sẵn",
      "Kiểm tra chất lượng dữ liệu",
    ],
    requires: ["SQL join & aggregate", "Excel nâng cao", "1 dự án phân tích cá nhân"],
  },
  {
    id: "intern-ba",
    title: "Thực tập sinh BA",
    stage: "entry",
    fit: 76,
    salary: "4–6 triệu",
    summary: "Ít yêu cầu kỹ thuật hơn, nặng về tài liệu và giao tiếp.",
    does: [
      "Ghi biên bản họp với stakeholder",
      "Viết user story và tài liệu mô tả",
      "Vẽ luồng nghiệp vụ đơn giản",
    ],
    requires: ["Hiểu quy trình nghiệp vụ", "Viết tài liệu rõ ràng", "Biết Jira, Figma cơ bản"],
  },
  {
    id: "intern-mkt",
    title: "Thực tập sinh Marketing",
    stage: "entry",
    fit: 88,
    salary: "3–5 triệu",
    summary: "Bạn đã đi qua chặng này — kinh nghiệm sẵn có.",
    does: [
      "Theo dõi hiệu quả chiến dịch",
      "Làm báo cáo số liệu định kỳ",
      "Phối hợp nội dung và kênh",
    ],
    requires: ["Đã hoàn thành ở Beta Media"],
  },

  {
    id: "data-analyst",
    title: "Data Analyst",
    stage: "core",
    fit: 87,
    salary: "12–18 triệu",
    summary: "Biến dữ liệu thành quyết định kinh doanh.",
    does: [
      "Tự đặt câu hỏi và tìm câu trả lời trong dữ liệu",
      "Dựng và bảo trì hệ dashboard cho một mảng",
      "Trình bày insight cho quản lý, bảo vệ kết luận",
    ],
    requires: ["SQL window functions", "Python cho phân tích", "Kể chuyện bằng số liệu"],
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    stage: "core",
    fit: 81,
    salary: "11–16 triệu",
    summary: "Cầu nối giữa kinh doanh và công nghệ.",
    does: [
      "Lấy yêu cầu và chuyển thành đặc tả cho dev",
      "Chủ trì họp với các bên liên quan",
      "Nghiệm thu tính năng trước khi phát hành",
    ],
    requires: ["Phân tích nghiệp vụ", "Viết BRD/URD", "SQL đủ để tự kiểm chứng"],
  },
  {
    id: "product-owner",
    title: "Associate Product Owner",
    stage: "core",
    fit: 68,
    salary: "13–18 triệu",
    summary: "Định hình sản phẩm từ nhu cầu người dùng.",
    does: [
      "Quản lý backlog và thứ tự ưu tiên",
      "Quyết định làm gì trước, bỏ gì lại",
      "Đo lường tính năng sau khi ra mắt",
    ],
    requires: ["Tư duy sản phẩm", "Hiểu người dùng", "Kinh nghiệm BA hoặc Data trước đó"],
  },
  {
    id: "digital-marketing",
    title: "Digital Marketing",
    stage: "core",
    fit: 62,
    salary: "10–14 triệu",
    summary: "Tối ưu tăng trưởng bằng quảng cáo số.",
    does: [
      "Chạy và tối ưu chiến dịch trả phí",
      "Phân tích phễu chuyển đổi",
      "Quản lý ngân sách theo hiệu quả",
    ],
    requires: ["Google/Meta Ads", "Đọc số liệu chiến dịch", "A/B testing"],
  },

  {
    id: "senior-da",
    title: "Senior Data Analyst",
    stage: "growth",
    fit: 74,
    salary: "25–35 triệu",
    summary: "Dẫn dắt phân tích cho cả một mảng kinh doanh.",
    does: [
      "Định nghĩa chỉ số chuẩn cho công ty",
      "Hướng dẫn analyst mới",
      "Làm việc trực tiếp với ban lãnh đạo",
    ],
    requires: ["2–3 năm làm DA", "Thống kê vững", "Ảnh hưởng không cần quyền"],
  },
  {
    id: "analytics-engineer",
    title: "Analytics Engineer",
    stage: "growth",
    fit: 66,
    salary: "28–40 triệu",
    summary: "Xây nền dữ liệu cho cả tổ chức dùng.",
    does: [
      "Thiết kế mô hình dữ liệu (dbt, warehouse)",
      "Chuẩn hoá pipeline và định nghĩa chỉ số",
      "Đưa kỷ luật kỹ thuật vào đội phân tích",
    ],
    requires: ["Python & Git thành thạo", "Mô hình hoá dữ liệu", "Hiểu kỹ thuật hệ thống"],
  },
  {
    id: "product-analyst",
    title: "Product Analyst",
    stage: "growth",
    fit: 71,
    salary: "22–32 triệu",
    summary: "Phân tích hành vi để định hướng sản phẩm.",
    does: [
      "Thiết kế và đọc kết quả thử nghiệm",
      "Phân tích phễu và giữ chân người dùng",
      "Ngồi cùng team sản phẩm mỗi ngày",
    ],
    requires: ["Thống kê thử nghiệm", "Công cụ analytics sản phẩm", "Tư duy sản phẩm"],
  },
  {
    id: "ba-lead",
    title: "Product Owner",
    stage: "growth",
    fit: 63,
    salary: "30–45 triệu",
    summary: "Chịu trách nhiệm kết quả của một sản phẩm.",
    does: [
      "Sở hữu lộ trình sản phẩm",
      "Cân đối giữa kinh doanh, kỹ thuật và người dùng",
      "Chịu trách nhiệm về chỉ số sản phẩm",
    ],
    requires: ["2–3 năm BA hoặc APO", "Dẫn dắt liên phòng ban", "Ra quyết định có đánh đổi"],
  },
  {
    id: "growth-lead",
    title: "Growth Lead",
    stage: "growth",
    fit: 58,
    salary: "25–40 triệu",
    summary: "Dẫn dắt tăng trưởng bằng dữ liệu và thử nghiệm.",
    does: [
      "Sở hữu chỉ tiêu tăng trưởng",
      "Điều phối marketing, sản phẩm và dữ liệu",
      "Xây hệ thống thử nghiệm liên tục",
    ],
    requires: ["Kinh nghiệm performance marketing", "Đọc dữ liệu tốt", "Quản lý ngân sách lớn"],
  },
];

export const pathEdges: PathEdge[] = [
  { from: "you", to: "intern-da", via: "Học SQL nâng cao + 1 dự án portfolio" },
  { from: "you", to: "intern-ba", via: "Luyện viết tài liệu, học Jira" },
  { from: "you", to: "intern-mkt", via: "Bạn đã có kinh nghiệm này" },

  { from: "intern-da", to: "data-analyst", via: "6–9 tháng làm thật, thêm Python" },
  { from: "intern-da", to: "business-analyst", via: "Chuyển hướng sang nghiệp vụ" },
  { from: "intern-ba", to: "business-analyst", via: "6–12 tháng làm tài liệu và nghiệm thu" },
  { from: "intern-ba", to: "product-owner", via: "Cần thêm tư duy sản phẩm" },
  { from: "intern-mkt", to: "digital-marketing", via: "Nắm được Ads và tối ưu phễu" },
  { from: "intern-mkt", to: "data-analyst", via: "Chuyển hướng: học SQL và phân tích" },

  { from: "data-analyst", to: "senior-da", via: "2–3 năm, dẫn dắt phân tích" },
  { from: "data-analyst", to: "analytics-engineer", via: "Đi sâu kỹ thuật: dbt, Python" },
  { from: "data-analyst", to: "product-analyst", via: "Gắn với một sản phẩm cụ thể" },
  { from: "business-analyst", to: "ba-lead", via: "Nhận trách nhiệm về kết quả" },
  { from: "business-analyst", to: "product-analyst", via: "Bổ sung kỹ năng phân tích" },
  { from: "product-owner", to: "ba-lead", via: "Tự nhiên tiếp nối" },
  { from: "digital-marketing", to: "growth-lead", via: "Sở hữu chỉ tiêu tăng trưởng" },
  { from: "digital-marketing", to: "product-analyst", via: "Chuyển sang phân tích sản phẩm" },
];

/** The path currently being pursued — lit by default when the map opens. */
export const defaultTargetId = "data-analyst";
