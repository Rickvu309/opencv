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
import type { Msg } from "@/lib/i18n/locale";

const msg = (en: string): Msg => en;

const cannedReplies: {
  keywords: string[];
  content: Msg;
}[] = [
  {
    keywords: ["cv", "hồ sơ", "resume", "profile"],
    content: msg("I've lost my connection, so I can't read your profile.\n\nOne thing is " +
        "nearly always worth doing meanwhile: turn every bullet from a job " +
        "description into a result, with a number where you have one. You can " +
        "do that in the CV tab now."),
  },
  {
    keywords: ["ưu tiên", "tuần tới", "bắt đầu", "priorit", "next week", "start"],
    content: msg("I'm offline, so I can't read your profile.\n\nThe rule holds anyway: " +
        "two things finished beat five started. Pick exactly two for this " +
        "week and leave the rest."),
  },
  {
    keywords: ["so sánh", "nên chọn", "hướng nào", "compare", "which", "should i"],
    content: msg("I'd rather answer this from your real profile, and I can't read it " +
        "right now.\n\nTry again in a moment and I'll weigh each direction " +
        "against what you already have."),
  },
];

// Every canned reply ends by telling the user to ask again, because asking
// again is what retries the connection. The old copy said "leave the question
// here, when I'm back I'll answer it", which nothing in the app could keep:
// there was no retry, and the promise held until the user gave up.
const fallbackReply = msg("I've lost my connection, so I can't answer this properly.\n\nAsk me again " +
    "and I'll try to reconnect.");

export function pickReply(input: string): { content: string } {
  const text = input.toLowerCase();
  const match = cannedReplies.find((r) =>
    r.keywords.some((k) => text.includes(k)),
  );
  return { content: match?.content ?? fallbackReply };
}
