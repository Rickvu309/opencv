/**
 * What the Coach can say with no model behind it.
 *
 * These used to be four long answers written for one seeded student, quoting
 * her GPA and her market numbers at whoever happened to be reading. Offline is
 * exactly the moment the app knows least, so answering with confident specifics
 * it cannot have checked is the worst thing it could do. What survives is the
 * honest version: name what the user asked about, say the one thing that is
 * true regardless, and get out of the way until the Coach is back.
 */
import type { Locale, Msg } from "@/lib/i18n/locale";

const msg = (vi: string, en: string): Msg => ({ vi, en });

const cannedReplies: {
  keywords: string[];
  content: Msg;
}[] = [
  {
    keywords: ["cv", "hồ sơ", "resume", "profile"],
    content: msg(
      "Mình đang mất kết nối nên chưa đọc được hồ sơ của bạn.\n\nTrong lúc " +
        "chờ, có một việc gần như luôn đáng làm với CV: đổi mỗi gạch đầu dòng " +
        "từ mô tả công việc sang kết quả, kèm số liệu nếu có. Bạn sửa được " +
        "ngay ở mục CV.",
      "I've lost my connection, so I can't read your profile.\n\nOne thing is " +
        "nearly always worth doing meanwhile: turn every bullet from a job " +
        "description into a result, with a number where you have one. You can " +
        "do that in the CV tab now.",
    ),
  },
  {
    keywords: ["ưu tiên", "tuần tới", "bắt đầu", "priorit", "next week", "start"],
    content: msg(
      "Mình đang ngoại tuyến nên chưa xem được hồ sơ của bạn.\n\nNguyên " +
        "tắc vẫn đúng: hai việc làm xong hơn năm việc dở dang. Tuần này bạn " +
        "chọn đúng hai việc, để phần còn lại đấy đã.",
      "I'm offline, so I can't read your profile.\n\nThe rule holds anyway: " +
        "two things finished beat five started. Pick exactly two for this " +
        "week and leave the rest.",
    ),
  },
  {
    keywords: ["so sánh", "nên chọn", "hướng nào", "compare", "which", "should i"],
    content: msg(
      "Câu này mình muốn trả lời từ hồ sơ thật của bạn, mà lúc này chưa đọc " +
        "được.\n\nBạn thử lại sau một chút nhé, mình sẽ so từng hướng với " +
        "những gì bạn đã có.",
      "I'd rather answer this from your real profile, and I can't read it " +
        "right now.\n\nTry again in a moment and I'll weigh each direction " +
        "against what you already have.",
    ),
  },
];

// Every canned reply ends by telling the user to ask again, because asking
// again is what retries the connection. The old copy said "leave the question
// here, when I'm back I'll answer it", which nothing in the app could keep:
// there was no retry, and the promise held until the user gave up.
const fallbackReply = msg(
  "Mình đang mất kết nối nên chưa trả lời kỹ được câu này.\n\nBạn hỏi lại " +
    "một lần nữa nhé, mình sẽ thử kết nối lại.",
  "I've lost my connection, so I can't answer this properly.\n\nAsk me again " +
    "and I'll try to reconnect.",
);

export function pickReply(input: string, locale: Locale): { content: string } {
  const text = input.toLowerCase();
  const match = cannedReplies.find((r) =>
    r.keywords.some((k) => text.includes(k)),
  );
  return { content: (match?.content ?? fallbackReply)[locale] };
}
