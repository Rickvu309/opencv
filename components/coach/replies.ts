import { type ChatMessage } from "@/lib/data";

export type Suggestion = NonNullable<ChatMessage["suggestion"]>;

const cannedReplies: {
  keywords: string[];
  content: string;
  suggestion?: Suggestion;
}[] = [
  {
    keywords: ["ưu tiên", "2 tuần", "tuần tới"],
    content:
      "Dựa trên kế hoạch hiện tại, 2 tuần tới mình khuyên tập trung vào đúng 2 việc — không hơn:\n\n1. Bắt đầu khoá Power BI (Microsoft Learn). Đây là mục tiếp theo trong Giai đoạn 1, và 64% tin tuyển DA fresher yêu cầu ít nhất 1 công cụ visualization. Mục tiêu cụ thể: dựng xong dashboard đầu tiên từ dữ liệu bán hàng mẫu.\n\n2. Duy trì 20 phút SQL mỗi ngày trên StrataScratch. Bạn vừa hoàn thành khoá trung cấp — nếu dừng luyện bây giờ, phần join nâng cao và window functions sẽ rơi rất nhanh.\n\nĐừng thêm việc mới. Hoàn thành đều đặn 2 việc này đáng giá hơn 5 việc dở dang. Mình có thể ghim mục tiêu Power BI vào Career Map để bạn theo dõi tiến độ hằng tuần.",
    suggestion: {
      kind: "adjust-map",
      label: "Cập nhật mục tiêu Power BI trong Career Map",
    },
  },
  {
    keywords: ["business analyst", "so sánh"],
    content:
      "So sánh thẳng theo hồ sơ của bạn, không nói chung chung:\n\n1. Độ phù hợp: Data Analyst 87% so với Business Analyst 81% — bạn hợp cả hai, nhưng DA nhỉnh hơn nhờ nền định lượng tốt và kỳ thực tập đã làm việc với số liệu thật.\n\n2. Thời gian sẵn sàng: BA nhanh hơn (4–6 tháng so với 6–9 tháng) vì ít yêu cầu kỹ thuật sâu; chuyên ngành HTTT quản lý của bạn là nền chuẩn cho BA.\n\n3. Thu nhập fresher: DA 12–18 triệu, BA 11–16 triệu — chênh không nhiều ở entry, nhưng trần dài hạn của DA cao hơn nếu bạn phát triển tiếp lên Analytics Engineer.\n\nLời khuyên của mình: giữ DA làm hướng chính vì bạn đã đi được ~58% chặng đường. BA là phương án dự phòng rất tốt — SQL và kỹ năng giao tiếp bạn đang luyện dùng được cho cả hai, nên không có nỗ lực nào lãng phí.",
  },
  {
    keywords: ["cv", "thực tập", "review"],
    content:
      "Mô tả hiện tại trong hồ sơ của bạn: “Phân tích số liệu chiến dịch, làm báo cáo tuần bằng Excel & Looker Studio” — đúng, nhưng chưa bán được bạn. Ba chỉnh sửa:\n\n1. Thêm quy mô: “Phân tích số liệu cho các chiến dịch ngân sách ~200 triệu/tháng”. Con số làm nhà tuyển dụng dừng mắt.\n\n2. Thêm kết quả: báo cáo của bạn dẫn tới quyết định gì? Ví dụ “giúp team điều chỉnh phân bổ ngân sách kênh, cải thiện CTR ~15%”. Ước lượng có căn cứ vẫn tốt hơn không có gì.\n\n3. Đổi động từ: “Xây dựng quy trình báo cáo tuần bằng Looker Studio” chủ động hơn hẳn “làm báo cáo tuần”.\n\nSửa xong gửi mình bản nháp mới nhé — mình review tiếp vòng 2.",
  },
  {
    keywords: ["thị trường", "cần gì", "tuyển dụng"],
    content:
      "Số liệu quý 3/2026 cho vị trí Data Analyst fresher tại VN:\n\n1. 78% tin tuyển yêu cầu SQL thành thạo — bạn đang đi đúng khi ưu tiên kỹ năng này.\n\n2. 64% yêu cầu ít nhất một công cụ visualization; Power BI phổ biến nhất, sau đó là Looker.\n\n3. 41% ưu tiên ứng viên có portfolio công khai — đây là khoảng trống lớn nhất của bạn hiện tại, sẽ giải quyết ở Giai đoạn 2.\n\n4. Tuyển dụng tăng ~25%/năm, mạnh nhất ở fintech và e-commerce — đúng nhóm công ty bạn nên nhắm cho đợt ứng tuyển tháng 7–9.\n\nKết luận: thị trường đang cần chính xác những gì có trong kế hoạch của bạn. Vấn đề không còn là chọn học gì, mà là giữ nhịp.",
  },
];

const fallbackReply =
  "Câu hỏi hay — để mình đặt nó vào bối cảnh của bạn: sinh viên năm 3 HTTT quản lý, mục tiêu Data Analyst, đang ở khoảng 58% chặng đường.\n\nNguyên tắc mình luôn giữ: quyết định dựa trên dữ liệu thị trường và hồ sơ thực tế, không phải cảm giác hay trend. Trước khi thay đổi gì trong lộ trình, hãy tự hỏi: điều này có rút ngắn khoảng cách về SQL, portfolio hoặc Python không?\n\nBạn kể cụ thể hơn tình huống đang gặp được không? Càng chi tiết, mình tư vấn càng sát.";

export function pickReply(input: string) {
  const text = input.toLowerCase();
  const match = cannedReplies.find((r) =>
    r.keywords.some((k) => text.includes(k)),
  );
  return match ?? { content: fallbackReply, suggestion: undefined };
}
