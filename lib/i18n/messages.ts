// Every word the product says, in both languages.
//
// ## Why a catalog rather than strings in place
//
// Two reasons, and neither is "because i18n libraries do it this way". First,
// the same idea was worded three different ways across three screens ("Cập nhật
// thông tin", "Làm lại onboarding" and "Chỉnh sửa" all opened the same form),
// which is invisible while the copy is scattered and obvious the moment it sits
// in one list. Second, a pair written side by side is reviewable: you can see
// at a glance whether the English is a translation of the Vietnamese or a
// sentence someone would actually write.
//
// ## Rules the entries follow
//
// - **Buttons start with a verb** naming the action. Never "OK", never "Yes"
//   on anything consequential; a confirmation repeats what it will do.
// - **Sentence case everywhere**, both languages. Title Case On Buttons next to
//   sentence case in headings reads as sloppiness, and sentence case survives
//   translation without per-word rules.
// - **Errors are instructions**, placed next to what failed. No "Oops", no
//   exclamation marks, no blame.
// - **Counts are templated**, never concatenated around a number: word order
//   moves between languages, so each entry takes the number and returns a whole
//   sentence.
// - **Links name their destination.** No bare "Xem thêm" / "Learn more".
//
// ## Voice
//
// `PRODUCT.md`: a good older mentor. Encouraging, never flattering, willing to
// say the distance is long. In Vietnamese that is "mình"/"bạn" and short plain
// sentences. In English it is second person, contractions allowed, no
// exclamation marks, and none of the startup cheerfulness the Vietnamese voice
// would never use either.

import type { Msg } from "./locale";

/** Shorthand so an entry reads as one line rather than four. */
const m = (vi: string, en: string): Msg => ({ vi, en });

export const messages = {
  /* ── Shared vocabulary ──────────────────────────────────────────────── */
  // One name per action, used everywhere that action appears. This block is
  // the reason "Lưu" and "Lưu thay đổi" cannot drift apart again.
  common: {
    save: m("Lưu thay đổi", "Save changes"),
    cancel: m("Huỷ", "Cancel"),
    edit: m("Chỉnh sửa", "Edit"),
    delete: m("Xoá", "Delete"),
    add: m("Thêm", "Add"),
    close: m("Đóng", "Close"),
    undo: m("Hoàn tác", "Undo"),
    optional: m("không bắt buộc", "optional"),
    notAddedYet: m("Chưa có", "Not added yet"),
    added: m("đã có", "added"),
    missing: m("chưa có", "not added"),
    language: m("Ngôn ngữ", "Language"),
    loading: m("Đang tải", "Loading"),
    search: m("Tìm kiếm", "Search"),
    openSidebar: m("Mở thanh bên", "Open sidebar"),
    toggleSidebar: m("Đóng/mở thanh bên", "Toggle sidebar"),
    resizeSidebar: m(
      "Kéo để đổi rộng thanh bên, nhấn đúp để đóng",
      "Drag to resize the sidebar, double-click to close",
    ),
    skipToContent: m("Bỏ qua tới nội dung chính", "Skip to main content"),
    moveUp: m("Chuyển lên trên", "Move up"),
    moveDown: m("Chuyển xuống dưới", "Move down"),
    explain: (title: string) => m(`Giải thích: ${title}`, `About ${title}`),
  },

  /* ── Profile context rows ───────────────────────────────────────────── */
  // These are both interface copy and stored data: a context row is keyed by
  // its label. Written in whichever language the user was reading at the time,
  // so anything looking one up has to accept either (see `matchesMsg`).
  context: {
    gender: m("Giới tính", "Gender"),
    birthYear: m("Năm sinh", "Year of birth"),
    certainty: m("Mức độ chắc chắn về mục tiêu", "How settled on the goal"),
    location: m("Địa điểm", "Location"),
  },

  /* ── Navigation ─────────────────────────────────────────────────────── */
  nav: {
    coach: m("Coach", "Coach"),
    career: m("Sự nghiệp", "Career"),
    profile: m("Hồ sơ", "Profile"),
    cv: m("CV", "CV"),
    papers: m("Thư và bài viết", "Letters"),
    pitch: m("Giới thiệu bản thân", "Your pitch"),
    search: m("Việc đang tuyển", "Openings"),
    applications: m("Đơn ứng tuyển", "Applications"),
    billing: m("Gói và thanh toán", "Plan and billing"),
    support: m("Trợ giúp", "Help"),
    // One name for one destination. This link used to be "Cập nhật thông tin"
    // in the account menu and "Làm lại onboarding" in the help menu, which read
    // as two different places.
    editProfileDetails: m("Cập nhật thông tin của bạn", "Update your details"),
    yourProfile: m("Hồ sơ của bạn", "Your profile"),
    noGoalYet: m("Chưa đặt mục tiêu", "No goal set yet"),
  },

  /* ── Landing ────────────────────────────────────────────────────────── */
  // The page has one job: say what this is, who it is for, and what makes it
  // different, in the two sentences a visitor gives it. Written per language
  // rather than translated: the Vietnamese leads with the reassurance, the
  // English leads with the claim, because that is how each reads naturally.
  landing: {
    audience: m(
      "Cho sinh viên và người mới ra trường",
      "For students and new graduates",
    ),
    // The promise, not a tagline. "Sẵn sàng" carries readiness; the English
    // says what readiness is for.
    headline1: m("Sẵn sàng cho công việc", "Be ready for work"),
    headline2: m("bạn thật sự muốn làm.", "that's actually worth doing."),
    subhead: m(
      "Coach viết CV, gọt lời giới thiệu và tìm việc hợp với bạn. Bạn vẫn là người quyết.",
      "The Coach writes your CV, sharpens your pitch and finds jobs that fit. You stay in control.",
    ),
    tryIt: m("Bắt đầu miễn phí", "Start free"),
    joinWaitlist: m("Để lại email", "Leave your email"),
    waitlistLead: m(
      "Có chỗ trống là mình báo bạn ngay.",
      "We'll email you when a place opens.",
    ),
    alreadyJoined: m(
      "Bạn đã ở trong danh sách chờ. Cứ dùng thử trong lúc đợi.",
      "You're on the list. Look around while you wait.",
    ),

    // Two pillars, in student words. Not "personal branding" and "job
    // discovery": prepare, then land something.
    pillarsHeading: m("Hai việc, theo thứ tự", "Two things, in order"),
    pillar1Title: m("Chuẩn bị cho tử tế", "Get yourself ready"),
    pillar1Body: m(
      "CV, thư xin việc, bài giới thiệu bản thân, câu trả lời phỏng vấn. Viết từ hồ sơ thật của bạn, không bịa.",
      "A CV, a cover letter, a self-introduction, interview answers. Written from your real profile, nothing invented.",
    ),
    pillar2Title: m("Rồi tìm đúng chỗ", "Then find the right place"),
    pillar2Body: m(
      "Dán một tin tuyển dụng vào, app nói bạn khớp mấy phần và còn thiếu gì. Theo dõi từng đơn tới lúc có kết quả.",
      "Paste a posting and see which requirements you meet. Track every application to an outcome.",
    ),

    // How it works. Three concrete steps, no numbers nobody measured.
    howHeading: m("Cách nó chạy", "How it works"),
    how1: m(
      "Bạn nói mục tiêu và những gì đã có.",
      "You say what you're aiming at and what you've got.",
    ),
    how2: m(
      "Coach dựng hồ sơ cùng bạn, sửa được từng dòng.",
      "The Coach builds your materials with you, editable line by line.",
    ),
    how3: m(
      "Bạn nộp, và biết chính xác mình đang đứng ở đâu.",
      "You apply, and you know exactly where you stand.",
    ),
    // The control promise, said plainly because it is the differentiator and
    // the thing a reader is right to be suspicious of.
    controlNote: m(
      "Mọi thay đổi Coach làm đều hiện ra kèm nút hoàn tác. Không có gì xảy ra sau lưng bạn.",
      "Every change the Coach makes shows up with an undo button. Nothing happens behind your back.",
    ),
  },

  /* ── Onboarding ─────────────────────────────────────────────────────── */
  onboarding: {
    stepOf: (step: number, total: number) =>
      m(`Bước ${step}/${total}`, `Step ${step} of ${total}`),
    privacy: m(
      "Chỉ dùng để cá nhân hoá lời khuyên. Sửa lại bất cứ lúc nào.",
      "Only used to shape your advice. Change it any time.",
    ),
    backStep: m("Quay lại bước trước", "Back to the previous step"),

    // Three screens, goal first. The old four asked for gender and year of
    // birth before anything else and put the goal last, which is the one
    // question the visitor actually arrived with.
    step1Label: m("Mục tiêu", "Your goal"),
    startLabel: m("Xuất phát", "Your start"),
    haveLabel: m("Đã có", "What you have"),

    goalHeadline: m("Bạn đang nhắm tới đâu?", "What are you aiming at?"),
    goalSupport: m(
      "Chọn một hướng, hoặc nói thẳng là chưa biết. Cả hai đều dùng được.",
      "Pick a direction, or say you're not sure. Either works.",
    ),
    goalNext: m("Tiếp tục · Xuất phát", "Continue · Your start"),

    unsureTitle: m("Mình chưa biết", "I'm not sure yet"),
    unsureNote: m(
      "Mình sẽ chỉ hướng gần bạn nhất.",
      "We'll show the direction you're closest to.",
    ),
    otherRole: m("Hoặc tự ghi vị trí khác", "Or name another role"),

    startHeadline: m("Bạn đang ở đâu?", "Where are you starting from?"),
    startSupport: m(
      "Ba câu hỏi. Con số bên dưới đổi theo từng câu bạn trả lời.",
      "Three questions. The number below moves with each answer.",
    ),
    startNext: m("Tiếp tục · Đã có", "Continue · What you have"),

    haveHeadline: m("Bạn đã có sẵn gì?", "What have you got already?"),
    haveSupport: m(
      "Khoá học, chứng chỉ, kỹ năng. Mỗi dòng một thứ.",
      "Courses, certificates, skills. One per line.",
    ),
    finishNext: m("Xong · gặp Coach", "Finish · meet the Coach"),

    fitFor: m("Mức phù hợp của bạn", "How close you are"),

    // The guided tour. Four cards, in the order somebody meets the product:
    // who does the work, where their materials live, how jobs are found, and
    // the promise that makes the first card acceptable.
    tourSkip: m("Bỏ qua", "Skip"),
    tourNext: m("Tiếp", "Next"),
    tourDone: m("Xong, vào Coach", "Done, meet the Coach"),
    tourStep: (at: number, of: number) => m(`${at}/${of}`, `${at} of ${of}`),
    tour1Title: m("Coach làm cùng bạn", "The Coach works with you"),
    tour1Body: m(
      "Không chỉ khuyên. Bạn nhờ một câu, Coach viết CV, sửa thư, thêm mục vào hồ sơ, ngay trong app.",
      "Not just advice. Ask once and the Coach writes your CV or edits a letter, here.",
    ),
    tour2Title: m("Bạn vẫn là người quyết", "You stay in control"),
    tour2Body: m(
      "Mỗi thay đổi hiện một thẻ kèm nút hoàn tác. Xoá thì Coach hỏi trước. Không có gì xảy ra sau lưng bạn.",
      "Every change shows a card with an undo button. Deletions ask first. Nothing happens behind your back.",
    ),
    tour3Title: m("Hồ sơ của bạn ở đâu", "Where your materials live"),
    tour3Body: m(
      "CV, thư xin việc, bài giới thiệu bản thân, mỗi thứ một màn hình bên trái. Sửa tay lúc nào cũng được.",
      "Your CV, letters and pitch each have a screen. Edit any of it by hand.",
    ),
    tour4Title: m("Tìm việc và theo dõi", "Find jobs and track them"),
    tour4Body: m(
      "Dán một tin tuyển dụng, app nói bạn khớp mấy phần và thiếu gì. Nộp rồi thì theo dõi tới lúc có kết quả.",
      "Paste a posting and see what you're missing. Then track it to an outcome.",
    ),

    // The activation checklist.
    checklistTitle: m("Bốn việc đầu tiên", "Your first four"),
    checklistLead: m(
      "Làm xong bốn việc này là bạn dùng được hết app.",
      "Do these four and you've used the whole product.",
    ),
    checklistDismiss: m("Ẩn danh sách này", "Hide this"),
    stepGoal: m("Đặt mục tiêu nghề nghiệp", "Set a career goal"),
    stepFacts: m("Thêm một khoá học hoặc kinh nghiệm", "Add a course or an experience"),
    stepDocument: m("Dựng thứ đầu tiên: CV, thư, hoặc lời giới thiệu", "Make something: a CV, a letter, or a pitch"),
    stepCoach: m("Nói chuyện với Coach một lần", "Talk to the Coach once"),
    // These two moved here from the career map when it was retired. The live
    // fit score outlived the map, and so did the words it needs.
    requirementMet: m("Đã đạt", "Met"),
    requirementMissing: m("Chưa đạt", "Not yet"),
    fitClosest: m("Hiện bạn gần nhất với", "Right now you're closest to"),
    fitNote: m(
      "Đây là điểm xuất phát, không phải kết luận. Coach sẽ giúp bạn rút ngắn.",
      "This is a starting line, not a verdict. The Coach helps you close it.",
    ),

    name: m("Họ và tên", "Full name"),
    gender: m("Giới tính", "Gender"),
    genderPlaceholder: m("Chọn giới tính", "Select gender"),
    genderFemale: m("Nữ", "Female"),
    genderMale: m("Nam", "Male"),
    genderOther: m("Khác", "Other"),
    birthYear: m("Năm sinh", "Year of birth"),
    school: m("Trường", "School"),
    major: m("Chuyên ngành", "Field of study"),
    year: m("Năm học", "Year of study"),
    yearPlaceholder: m("Chọn năm học", "Select year"),
    year1: m("Năm 1", "First year"),
    year2: m("Năm 2", "Second year"),
    year3: m("Năm 3", "Third year"),
    year4: m("Năm 4", "Fourth year"),
    graduated: m("Đã tốt nghiệp", "Graduated"),
    gpa: m("GPA", "GPA"),
    gpaPlaceholder: m("VD: 3.4/4.0", "e.g. 3.4/4.0"),
    courses: m("Khoá học & chứng chỉ", "Courses and certificates"),
    coursesPlaceholder: m(
      "Mỗi khoá một dòng, ví dụ:\nGoogle Data Analytics (Coursera)\nIELTS 6.5",
      "One per line, for example:\nGoogle Data Analytics (Coursera)\nIELTS 6.5",
    ),
    linkedin: m("Đường dẫn LinkedIn", "LinkedIn URL"),
    linkedinPlaceholder: m(
      "linkedin.com/in/ten-cua-ban",
      "linkedin.com/in/your-name",
    ),
    cvFileName: m("Tên tệp CV", "CV file name"),
    cvFileNamePlaceholder: m("CV_TenBan.pdf", "Your_Name_CV.pdf"),
    targetRole: m("Công việc bạn đang nhắm tới", "The job you're aiming for"),
    targetRolePlaceholder: m("VD: Data Analyst", "e.g. Data Analyst"),
    certainty: m(
      "Bạn chắc chắn về hướng này đến mức nào?",
      "How settled are you on this direction?",
    ),
    certaintySure: m("Rất rõ", "Settled"),
    certaintySureNote: m(
      "Mình đã tìm hiểu kỹ và muốn theo hướng này.",
      "I've looked into it and I'm going this way.",
    ),
    certaintyLeaning: m("Tương đối", "Leaning that way"),
    certaintyLeaningNote: m(
      "Mình nghiêng về hướng này nhưng vẫn muốn so sánh thêm.",
      "I'm leaning this way but still comparing.",
    ),
    certaintyUnsure: m("Chưa rõ", "Still deciding"),
    certaintyUnsureNote: m(
      "Mình vẫn đang phân vân giữa nhiều lựa chọn.",
      "I'm weighing up several options.",
    ),
    certaintyReassure: m(
      "Chưa rõ cũng không sao. Đó là việc của Coach.",
      "Not sure? That's what the Coach is for.",
    ),
    // The four role blurbs that used to live here are gone: each role carries
    // its own summary and pay band, written once in lib/career-graph.ts.
    rolePickHint: m(
      "Hoặc chọn một vai trò:",
      "Or pick a role:",
    ),

    // Honest about what is happening. The old screen showed a spinner and
    // "AI đang phân tích hồ sơ…" for 1.8 seconds while nothing was analysed;
    // a product whose first principle is evidence over encouragement cannot
    // open by inventing work it did not do.
    savingTitle: m("Đã ghi lại, cảm ơn bạn", "Saved, thank you"),
    savingSupport: m(
      "Đang lưu hồ sơ rồi đưa bạn sang Coach.",
      "Saving your profile, then taking you to the Coach.",
    ),
    savingStatus: m("Đang lưu hồ sơ…", "Saving your profile…"),
  },

  /* ── Coach ──────────────────────────────────────────────────────────── */
  coach: {
    newChat: m("Đoạn chat mới", "New chat"),
    ongoingChat: m("Cuộc trò chuyện", "Current chat"),
    startNewChat: m("Bắt đầu đoạn chat mới", "Start a new chat"),
    openFullScreen: m("Mở toàn màn hình", "Open full screen"),
    minimise: m("Thu nhỏ", "Minimise"),
    hideRecent: m("Ẩn đoạn chat gần đây", "Hide recent chat"),
    composerPlaceholder: m("Hỏi Coach…", "Ask the Coach…"),
    send: m("Gửi tin nhắn", "Send message"),
    typing: m("Coach đang trả lời", "The Coach is answering"),
    stop: m("Dừng trả lời", "Stop answering"),

    // The reasoning panel. The model thinks before it answers, and on a plain
    // question that is most of the minute the user spends waiting.
    thinking: m("Coach đang suy nghĩ…", "The Coach is thinking…"),
    thoughtFor: (seconds: number) =>
      m(`Đã suy nghĩ ${seconds} giây`, `Thought for ${seconds}s`),
    thoughtBriefly: m("Đã suy nghĩ một lúc", "Thought for a moment"),

    // A tool call, at each point of its life. Only the success line comes from
    // the registry's own summary; these cover the states that have no summary
    // because nothing landed.
    toolRunning: m("Đang cập nhật…", "Making the change…"),
    toolFailed: m("Chưa thay đổi được gì", "Nothing was changed"),
    toolDenied: m("Bạn đã từ chối thay đổi này", "You declined this change"),
    approvalTitle: m("Cần bạn xác nhận", "Needs your confirmation"),
    openCv: m("Mở CV này", "Open this CV"),
    deleteChat: m("Xoá đoạn chat này", "Delete this chat"),
    switchChat: m("Chọn đoạn chat", "Switch conversation"),
    limitTitle: m("Đoạn chat này đã dài", "This conversation is full"),
    limitBody: m(
      "Mở đoạn chat mới để tiếp tục. Đoạn này vẫn được giữ lại.",
      "Start a new one to carry on. This one is kept.",
    ),
    readyWithName: (name: string) =>
      m(`Sẵn sàng khi bạn cần, ${name}`, `Ready when you are, ${name}`),
    ready: m("Sẵn sàng khi bạn cần", "Ready when you are"),
    answerInComposer: m(
      "Hoặc bạn cứ trả lời bằng lời của mình ở ô bên dưới.",
      "Or answer in your own words below.",
    ),

    // Chosen from state by lib/coach/starters.ts, four at a time. They used to
    // be four fixed lines, which meant the app offered to build a CV to someone
    // who had built three, and asked which direction suits you to someone who
    // had already named one.
    starterBuildCv: m(
      "Dựng CV từ hồ sơ của mình",
      "Build a CV from my profile",
    ),
    starterTailorCv: m(
      "Chỉnh CV cho một vị trí cụ thể",
      "Tailor my CV for a specific role",
    ),
    starterWhereToStart: m("Mình nên bắt đầu từ đâu?", "Where should I start?"),
    starterPrioritise: m(
      "Tuần này mình nên làm việc nào trước?",
      "What should I do first this week?",
    ),
    starterGapForRole: (role: string) =>
      m(`Để làm ${role} mình còn thiếu gì?`, `What's missing for ${role}?`),
    starterWhichDirection: m(
      "Mình hợp với hướng đi nào nhất?",
      "Which direction suits me best?",
    ),
    starterNoExperience: m(
      "Chưa có kinh nghiệm thì viết CV thế nào?",
      "How do I write a CV with no experience?",
    ),
    starterFillProfile: m(
      "Giúp mình hoàn thiện hồ sơ",
      "Help me finish my profile",
    ),
    starterMarketGap: m(
      "Hồ sơ của mình so với thị trường thế nào?",
      "How does my profile compare to the market?",
    ),

    offlineTitle: m("Coach đang ngoại tuyến", "The Coach is offline"),
    offlineBody: m(
      "Hỏi lại để thử kết nối lần nữa.",
      "Ask again to retry the connection.",
    ),
    backOnline: m("Coach đã kết nối lại", "The Coach is back"),
    emptyTurn: m(
      "Mình chưa trả lời được câu này. Bạn hỏi lại nhé.",
      "That didn't come through. Ask me again.",
    ),

    // The Coach's own sign-in is gone. It collected a shared demo password,
    // printed under the form, which was the whole tenancy story of that phase.
    // The agent now answers to the account, so the only thing left to say is
    // that the session ended, and where the way back is.
    sessionEndedTitle: m("Phiên đăng nhập đã hết", "Your session has ended"),
    sessionEndedBody: m(
      "Đăng nhập lại để tiếp tục đoạn chat này.",
      "Sign in again to pick this conversation back up.",
    ),
  },

  /* ── Profile ────────────────────────────────────────────────────────── */
  profile: {
    sections: m("Các phần trong hồ sơ", "Profile sections"),
    allSections: m("Tất cả các phần", "All sections"),
    completeness: m("Hồ sơ hoàn thiện", "Profile complete"),
    groupSelf: m("Bản thân", "About you"),
    groupDocuments: m("Tài liệu", "Documents"),
    missingCount: (n: number) =>
      m(`${n} phần chưa có`, n === 1 ? "1 section to add" : `${n} sections to add`),
    itemCount: (n: number) => m(`${n} mục`, n === 1 ? "1 entry" : `${n} entries`),
    versionCount: (n: number) =>
      m(`${n} bản`, n === 1 ? "1 version" : `${n} versions`),

    identity: m("Thông tin cá nhân", "Personal details"),
    fullName: m("Họ tên", "Full name"),
    aimingFor: m("Hướng tới", "Aiming for"),
    targetRole: m("Vai trò hướng tới", "Role you're aiming for"),
    identityNameRequired: m(
      "Nhập họ tên để lưu.",
      "Enter your name to save.",
    ),
    identityRoleRequired: m(
      "Nhập vai trò hướng tới để lưu.",
      "Enter your target role to save.",
    ),

    context: m("Bối cảnh & mục tiêu", "Situation and goals"),
    contextValueRequired: (label: string) =>
      m(`Điền giá trị cho “${label}” để lưu.`, `Fill in “${label}” to save.`),

    experience: m("Kinh nghiệm", "Experience"),
    experienceRole: m("Vai trò", "Role"),
    experienceOrg: m("Tổ chức", "Organisation"),
    experiencePeriod: m("Thời gian", "Dates"),
    experienceDetail: m("Bạn đã làm gì", "What you did"),
    experienceEntry: (n: number) => m(`Mục ${n}`, `Entry ${n}`),
    experienceRemove: m("Xoá mục này", "Remove this entry"),
    experienceAdd: m("Thêm kinh nghiệm", "Add experience"),
    experienceRequired: m(
      "Mọi mục cần có vai trò và tổ chức.",
      "Every entry needs a role and an organisation.",
    ),
    experienceEmptyTitle: m("Chưa có kinh nghiệm nào", "No experience added yet"),
    experienceEmptyBody: m(
      "Thực tập, câu lạc bộ, dự án lớp đều tính. Coach đọc phần này.",
      "Internships, clubs and coursework all count. The Coach reads this.",
    ),

    education: m("Học vấn & chứng chỉ", "Education and certificates"),
    school: m("Trường", "School"),
    major: m("Chuyên ngành", "Field of study"),
    yearAndGpa: m("Năm học", "Year"),
    schoolRequired: m("Nhập tên trường để lưu.", "Enter your school to save."),
    certificates: m("Chứng chỉ & khoá học", "Certificates and courses"),
    addCertificate: m("Thêm chứng chỉ", "Add a certificate"),
    certificatePlaceholder: m(
      "Google Data Analytics (Coursera)",
      "Google Data Analytics (Coursera)",
    ),
    removeCertificate: (name: string) =>
      m(`Xoá chứng chỉ ${name}`, `Remove ${name}`),

    docEmptyTitle: (kind: string) =>
      m(`Chưa có ${kind.toLowerCase()}`, `No ${kind.toLowerCase()} yet`),
    docBuildCv: m("Dựng CV trong OpenPath", "Build a CV here"),
    docUploadExisting: m("Tải CV có sẵn lên", "Upload an existing CV"),
    docAskCoach: m("Nhờ Coach xem lại", "Ask the Coach to review"),
    docAddVersion: m("Thêm bản", "Add a version"),
    docPrimary: m("Bản chính", "Primary"),
    docIsPrimary: (label: string) =>
      m(`${label} đang là bản chính`, `${label} is primary`),
    docMakePrimary: (label: string) =>
      m(`Đặt ${label} làm bản chính`, `Make ${label} primary`),
    docPrimaryHint: m(
      "Bản chính, Coach đọc bản này",
      "Primary. The Coach reads this one",
    ),
    docSetPrimary: m("Đặt làm bản chính", "Make primary"),
    docEdit: (label: string) => m(`Sửa ${label}`, `Edit ${label}`),
    docRemove: (label: string) => m(`Xoá ${label}`, `Delete ${label}`),
    docSync: (label: string) => m(`Đồng bộ ${label}`, `Sync ${label}`),
    docResync: m("Đồng bộ lại", "Sync again"),
    docUpdatedAt: (when: string) => m(`Cập nhật ${when}`, `Updated ${when}`),
    docSyncedAt: (when: string) => m(`Đồng bộ ${when}`, `Synced ${when}`),
    docNeverSynced: m("Chưa đồng bộ", "Never synced"),

    docFormLabel: m("Tên bản này", "Name this version"),
    docFormLabelHint: m(
      "Đặt tên theo việc bạn định dùng nó.",
      "Name it after the job it's for.",
    ),
    docFormPurpose: m("Dùng cho việc gì", "What it's for"),
    docFormPurposeFor: (role: string) =>
      m(`Ứng tuyển ${role}`, `Applying for ${role} roles`),
    docFormPurposePlaceholder: m(
      "Ứng tuyển Data Analyst ở fintech",
      "Junior Data Analyst roles in fintech",
    ),
    docFormRole: m("Vai trò nhắm tới", "Target role"),
    docFormLanguage: m("Ngôn ngữ", "Language"),
    docFormUrl: m("Đường dẫn", "Link"),
    docFormUrlHint: m(
      "Coach đọc lại đường dẫn này mỗi khi bạn bấm đồng bộ.",
      "The Coach re-reads this link each time you sync.",
    ),
    docFormFile: m("Tên tệp", "File name"),
    docFormUrlAlt: m("Hoặc dán đường dẫn", "Or paste a link"),
    docFormNote: m("Ghi chú cho Coach", "Note for the Coach"),
    docFormNotePlaceholder: m(
      "Bản này bỏ phần marketing, tập trung vào dự án data.",
      "Drops the marketing internship, leads with data projects.",
    ),
    docFormMakePrimary: m("Đặt làm bản chính", "Make this primary"),
    docFormMakePrimaryHint: m(
      "Coach đọc bản này, và nó hiện đầu danh sách.",
      "The Coach reads this one, and it shows first.",
    ),
    docFormSave: m("Lưu thay đổi", "Save changes"),
    docFormAdd: m("Thêm vào hồ sơ", "Add to profile"),
    docFormNeedLabel: m(
      "Đặt tên cho bản này để lưu.",
      "Name this version to save it.",
    ),
    docFormNeedUrl: m("Dán đường dẫn để lưu.", "Paste a link to save it."),
    docFormNeedSource: m(
      "Chọn tệp hoặc dán đường dẫn để lưu.",
      "Add a file name or a link to save it.",
    ),
  },

  /* ── CV builder ─────────────────────────────────────────────────────── */
  cv: {
    emptyTitle: m("Dựng CV đầu tiên của bạn", "Build your first CV"),
    emptyWithProfile: m(
      "Bắt đầu từ hồ sơ bạn đã điền, rồi sửa cho đúng vị trí bạn nhắm tới.",
      "Start from your profile, then tailor it to the job.",
    ),
    emptyWithoutProfile: m(
      "Điền hồ sơ trước thì CV có sẵn phần lớn nội dung. Hoặc bắt đầu từ trang trắng.",
      "Fill in your profile first and most of it writes itself. Or start blank.",
    ),
    buildFromProfile: m("Dựng từ hồ sơ", "Build from my profile"),
    startBlank: m("Bắt đầu trống", "Start blank"),
    fillProfileFirst: m("Điền hồ sơ trước", "Fill in your profile first"),

    yourCvs: m("CV của bạn", "Your CVs"),
    duplicate: m("Nhân bản CV này", "Duplicate this CV"),
    deleteCv: m("Xoá CV này", "Delete this CV"),
    blankCv: m("CV trống", "Blank CV"),
    copySuffix: (label: string) => m(`${label} (bản sao)`, `${label} (copy)`),
    untitled: (n: number) => m(`CV ${n}`, `CV ${n}`),
    forRole: (role: string) => m(`CV, ${role}`, `CV, ${role}`),
    completeness: m("Mức hoàn thiện của CV này", "How complete this CV is"),

    appearance: m("Giao diện", "Appearance"),
    // Named for the situation each one fits, not for its style. "Cổ điển" and
    // "Hiện đại" describe how a template looks to somebody who already knows
    // what a CV should look like; this audience is choosing their first one and
    // needs to be told which to use for a Vietnamese employer and which for an
    // application abroad. The identifiers in the model are unchanged.
    // A photo is a real decision here, not decoration: Vietnamese employers
    // expect one and many international and tech employers screen it out.
    photo: m("Ảnh chân dung", "Photo"),
    photoHint: m(
      "Mẫu chuẩn Việt Nam có chỗ cho ảnh.",
      "The Vietnamese standard template has a place for one.",
    ),
    photoAdd: m("Thêm ảnh", "Add a photo"),
    photoReplace: m("Đổi ảnh", "Replace it"),
    photoRemove: m("Bỏ ảnh", "Remove the photo"),
    photoAlt: m("Ảnh chân dung trên CV", "The photo on this CV"),
    photoFailed: m(
      "Chưa tải được ảnh lên. Thử lại nhé.",
      "That photo didn't upload. Try again.",
    ),
    template: m("Mẫu", "Template"),
    templateClassic: m("Chuẩn Việt Nam", "Vietnamese standard"),
    templateModern: m("Chuẩn quốc tế", "International"),
    templateCompact: m("Gọn một trang", "Fits one page"),
    accent: m("Màu nhấn", "Accent colour"),
    cvLanguage: m("Ngôn ngữ của CV", "CV language"),
    accentInk: m("Mực", "Ink"),
    accentBlue: m("Xanh dương", "Blue"),
    accentGreen: m("Xanh lá", "Green"),
    accentPlum: m("Mận", "Plum"),
    density: m("Độ chặt", "Spacing"),
    densityHint: m("để vừa một trang", "to fit one page"),
    densityAiry: m("Thoáng", "Roomy"),
    densityNormal: m("Vừa", "Normal"),
    densityTight: m("Chặt", "Tight"),

    exportLabel: m("Xuất", "Export"),
    exportDownload: m("Tải về", "Download"),
    exportMarkdown: m("Markdown", "Markdown"),
    exportText: m("Văn bản thuần", "Plain text"),
    exportJson: m("Dữ liệu gốc", "Raw data"),
    exportCopy: m("Chép để dán vào form", "Copy to paste into a form"),
    exportPdf: m("Xuất PDF", "Export PDF"),
    exportPdfHint: m(
      "Mở hộp thoại in, chọn “Save as PDF”",
      "Opens your print dialog. Choose “Save as PDF”.",
    ),
    downloaded: (file: string) => m(`Đã tải ${file}`, `Downloaded ${file}`),
    copied: m("Đã chép nội dung CV", "CV copied"),
    copyFailedTitle: m("Chưa chép được", "Couldn't copy"),
    copyFailedBody: m(
      "Trình duyệt chặn clipboard. Tải bản .txt về thay nhé.",
      "Your browser blocked the clipboard. Download the .txt instead.",
    ),

    cvName: m("Tên bản CV này", "Name this CV"),
    cvNamePlaceholder: m("CV, Data Analyst", "CV, Data Analyst"),
    headerName: m("Họ tên", "Full name"),
    headerHeadline: m("Một dòng giới thiệu", "One-line summary"),
    headerHeadlinePlaceholder: m(
      "Sinh viên năm 3 · hướng Data",
      "Third-year student · heading into data",
    ),
    headerEmail: m("Email", "Email"),
    headerPhone: m("Điện thoại", "Phone"),
    headerLocation: m("Nơi ở", "Location"),
    headerLocationPlaceholder: m("Hà Nội", "Hanoi"),
    headerLink: m("Liên kết", "Link"),
    headerLinkPlaceholder: m(
      "linkedin.com/in/ten-cua-ban",
      "linkedin.com/in/your-name",
    ),
    askCoachToRewrite: m("Nhờ Coach viết lại CV này", "Ask the Coach to rewrite this"),
    askCoachPrompt: (label: string) =>
      m(
        `Xem lại CV “${label}” của mình và sửa giúp mình những chỗ còn yếu`,
        `Review my CV “${label}” and tighten up the weak parts`,
      ),

    addSection: m("Thêm mục vào CV", "Add a section"),
    sectionName: m("Tên mục", "Section name"),
    hideSection: (heading: string) =>
      m(`Ẩn mục ${heading} khỏi bản in`, `Hide ${heading} from the printed CV`),
    showSection: (heading: string) =>
      m(`Hiện lại mục ${heading}`, `Show ${heading} again`),
    sectionHidden: m("Đang ẩn khỏi bản in", "Hidden from the printed CV"),
    sectionHide: m("Ẩn khỏi bản in", "Hide from the printed CV"),
    moveSectionUp: (heading: string) =>
      m(`Chuyển mục ${heading} lên trên`, `Move ${heading} up`),
    moveSectionDown: (heading: string) =>
      m(`Chuyển mục ${heading} xuống dưới`, `Move ${heading} down`),
    removeSection: (heading: string) =>
      m(`Xoá mục ${heading}`, `Delete ${heading}`),
    toggleSection: (heading: string) =>
      m(`Thu gọn hoặc mở mục ${heading}`, `Collapse or expand ${heading}`),

    addEntry: m("Thêm mục", "Add an entry"),
    entryNumber: (n: number) => m(`Mục ${n}`, `Entry ${n}`),
    entryTitle: m("Tên", "Title"),
    entryTitlePlaceholder: m("Thực tập sinh Data", "Data intern"),
    entryOrg: m("Nơi làm / trường", "Organisation"),
    entryOrgPlaceholder: m("Công ty ABC", "ABC Company"),
    entryPeriod: m("Thời gian", "Dates"),
    entryPeriodPlaceholder: m("06/2025 – 09/2025", "Jun 2025 – Sep 2025"),
    entryDetail: m("Bạn đã làm được gì", "What you achieved"),
    entryDetailPlaceholder: m(
      "Mỗi dòng một ý, ví dụ:\nDựng dashboard theo dõi 12 chiến dịch, rút thời gian báo cáo tuần từ 4h xuống 30 phút",
      "One per line, for example:\nBuilt a dashboard covering 12 campaigns, cutting weekly reporting from 4 hours to 30 minutes",
    ),
    entryDetailHint: m(
      "Mỗi dòng một gạch đầu dòng. Viết kết quả kèm số liệu.",
      "Each line becomes a bullet. Write results with numbers.",
    ),
    removeEntry: (title: string) => m(`Xoá ${title}`, `Delete ${title}`),
    previewEmpty: m(
      "Chưa có gì để xem. Điền vào phần bên trái.",
      "Nothing to show yet. Fill in the panel on the left.",
    ),

  },




  /* ── My Search ──────────────────────────────────────────────────────── */
  search: {
    title: m("Việc đang tuyển", "Openings"),
    lead: m(
      "Tin tuyển dụng thật, xếp theo mức khớp với hồ sơ của bạn.",
      "Real postings, ordered by how well they match your profile.",
    ),
    addOpening: m("Thêm tin tuyển dụng", "Add an opening"),
    pasteLabel: m("Dán tin tuyển dụng hoặc link", "Paste a posting or a link"),
    pastePlaceholder: m(
      "Dán cả tin ở đây. Mình tự tách yêu cầu ra.",
      "Paste the whole posting. I'll pull the requirements out.",
    ),
    pasteTooShort: m(
      "Dán thêm chút nữa nhé, chừng này chưa đủ để đọc.",
      "Paste a bit more; that isn't enough to read.",
    ),
    searchPlaceholder: m("Tìm theo vị trí hoặc công ty", "Search title or company"),
    filterAll: m("Tất cả", "All"),
    filterSaved: m("Đã lưu", "Saved"),
    filterSeeded: m("Ví dụ", "Examples"),
    save: m("Lưu tin này", "Save"),
    unsave: m("Bỏ lưu", "Unsave"),
    saved: m("Đã lưu", "Saved"),
    apply: m("Bắt đầu ứng tuyển", "Start applying"),
    seededNote: m(
      "Tin ví dụ, để bạn thấy phần khớp hoạt động thế nào.",
      "An example, so you can see how the match reads.",
    ),
    fitCount: (met: number, total: number) =>
      m(`Khớp ${met}/${total} yêu cầu`, `Meets ${met} of ${total} requirements`),
    fitUnknown: m(
      "Tin này chưa nêu yêu cầu nào đọc được",
      "This posting lists no requirement we can read",
    ),
    metHeading: m("Bạn đã có", "You have"),
    missingHeading: m("Còn thiếu", "Still missing"),
    unprovableHeading: m(
      "Không chấm được, nên không tính",
      "Not scoreable, so not counted",
    ),
    emptyProfileTitle: m("Hồ sơ còn trống", "Your profile is empty"),
    emptyProfileBody: m(
      "Thêm vài khoá học hoặc một mục kinh nghiệm, rồi mình xếp được.",
      "Add a course or two, or one experience, and I can rank these.",
    ),
    emptyProfileAction: m("Điền hồ sơ", "Fill in your profile"),
    noOpeningsTitle: m("Chưa có tin nào", "No openings yet"),
    noOpeningsBody: m(
      "Dán một tin bạn đang cân nhắc, mình đọc yêu cầu và nói bạn khớp tới đâu.",
      "Paste one you're considering and I'll read its requirements and tell you where you stand.",
    ),
    noMatches: m("Không có tin nào khớp", "Nothing matches that"),
  },

  /* ── My Applications ────────────────────────────────────────────────── */
  applications: {
    title: m("Đơn ứng tuyển", "Applications"),
    lead: m(
      "Mỗi vị trí bạn đã nộp, đang ở đâu, và việc tiếp theo là gì.",
      "Every job you've gone for, where it stands, and what to do next.",
    ),
    statusInterested: m("Đang cân nhắc", "Interested"),
    statusApplied: m("Đã nộp", "Applied"),
    statusInterviewing: m("Đang phỏng vấn", "Interviewing"),
    statusOffer: m("Có offer", "Offer"),
    statusRejected: m("Bị từ chối", "Rejected"),
    nextStep: m("Việc tiếp theo", "Next step"),
    notesLabel: m("Ghi chú", "Notes"),
    notesPlaceholder: m(
      "Ai phỏng vấn, họ hỏi gì, cần chuẩn bị gì.",
      "Who you spoke to, what they asked, what to prepare.",
    ),
    deadlineLabel: m("Hạn nộp", "Deadline"),
    clearDeadline: m("Bỏ hạn nộp", "Clear the deadline"),
    askCoach: m("Hỏi Coach việc tiếp theo", "Ask the Coach what's next"),
    askCoachPrompt: (title: string, org: string, status: string) =>
      m(
        `Mình đang ứng tuyển ${title}${org ? ` ở ${org}` : ""}, trạng thái: ${status}. Việc tiếp theo mình nên làm là gì?`,
        `I'm applying for ${title}${org ? ` at ${org}` : ""}, currently ${status}. What should I do next?`,
      ),
    tailorCv: m("Tạo bản CV riêng", "Tailor a CV for this"),
    tailorLetter: m("Tạo thư riêng", "Tailor a letter for this"),
    tailoredHeading: m("Hồ sơ riêng cho vị trí này", "Tailored for this job"),
    tailorNeedsCv: m(
      "Bạn dựng một CV trước đã, rồi mình sao ra bản riêng.",
      "Build a CV first, then I can copy it for this job.",
    ),
    emptyTitle: m("Chưa có đơn nào", "No applications yet"),
    emptyBody: m(
      "Lưu một tin ở mục Việc đang tuyển, rồi bắt đầu từ đó.",
      "Save an opening in Openings and start from there.",
    ),
    emptyAction: m("Xem việc đang tuyển", "Browse openings"),
    remove: m("Xoá đơn này", "Delete this application"),
  },

  /* ── Plans and billing ──────────────────────────────────────────────── */
  billing: {
    title: m("Gói và thanh toán", "Plan and billing"),
    lead: m(
      "Gói quyết định số lượt Coach mỗi tháng. Mọi thứ khác dùng thoải mái.",
      "Your plan sets how many Coach turns you get a month. Everything else is unlimited.",
    ),
    currentPlan: m("Gói hiện tại", "Current plan"),
    tierFree: m("Miễn phí", "Free"),
    tierPro: m("Pro", "Pro"),
    tierUltra: m("Ultra", "Ultra"),
    perMonth: (usd: number) => m(`$${usd}/tháng`, `$${usd}/month`),
    turnsPerMonth: (n: number) =>
      m(`${n} lượt Coach mỗi tháng`, `${n} Coach turns a month`),
    used: (used: number, total: number) =>
      m(`Đã dùng ${used}/${total} lượt`, `${used} of ${total} turns used`),
    renewsOn: (date: string) => m(`Kỳ mới ngày ${date}`, `Renews ${date}`),
    endsOn: (date: string) => m(`Hết hạn ngày ${date}`, `Ends ${date}`),
    upgrade: m("Nâng gói", "Upgrade"),
    downgrade: m("Hạ gói", "Downgrade"),
    cancelPlan: m("Huỷ gói", "Cancel plan"),
    cancelling: m("Đã hẹn huỷ, dùng hết kỳ này", "Cancelling at the end of this period"),
    pastDue: m("Thanh toán chưa thành công", "A payment didn't go through"),
    unavailable: m(
      "Chưa thanh toán được lúc này. Gói của bạn giữ nguyên.",
      "Payment isn't available right now. Your plan is unchanged.",
    ),
    // What the Coach says when the allowance is gone. The other tools keep
    // working, and the sentence says so.
    outOfTurns: m("Hết lượt Coach tháng này", "Out of Coach turns this month"),
    outOfTurnsBody: m(
      "CV, thư và đơn ứng tuyển vẫn dùng bình thường. Chỉ Coach cần chờ kỳ mới hoặc nâng gói.",
      "Your CV, letters and applications still work. Only the Coach waits for a new period or an upgrade.",
    ),
  },

  /* ── Help and support ───────────────────────────────────────────────── */
  // Named `support` because `help` is already the help *menu* further down;
  // this is the page it should have pointed at all along.
  support: {
    title: m("Trợ giúp", "Help"),
    lead: m(
      "Câu hỏi hay gặp, và cách báo lỗi cho tụi mình.",
      "Common questions, and how to tell us something is wrong.",
    ),
    q1: m("Coach có tự sửa hồ sơ của mình không?", "Does the Coach change my work?"),
    a1: m(
      "Có, khi bạn nhờ. Mỗi thay đổi hiện một thẻ kèm nút hoàn tác, và hành động xoá thì hỏi trước.",
      "Yes, when you ask. Every change shows a card with an undo button, and deletions ask first.",
    ),
    q2: m("Dữ liệu của mình ở đâu?", "Where is my data?"),
    a2: m(
      "Trong tài khoản của bạn trên máy chủ. Đăng nhập ở máy khác là thấy đủ.",
      "In your account on the server. Sign in anywhere and it's all there.",
    ),
    q3: m("Coach viết sai thì sao?", "What if the Coach gets something wrong?"),
    a3: m(
      "Bấm hoàn tác, rồi nói lại cho đúng. Nó cũng không được bịa số hay bịa kinh nghiệm.",
      "Press undo and tell it again. It also isn't allowed to invent numbers or experience.",
    ),
    q4: m("Hết lượt Coach thì mất gì?", "What happens when Coach turns run out?"),
    a4: m(
      "Không mất gì. CV, thư, đơn ứng tuyển vẫn dùng được; chỉ Coach phải chờ.",
      "Nothing. Your CV, letters and applications keep working; only the Coach waits.",
    ),
    reportTitle: m("Báo lỗi hoặc góp ý", "Report a problem"),
    reportPlaceholder: m(
      "Bạn đang làm gì thì gặp lỗi?",
      "What were you doing when it went wrong?",
    ),
    reportSend: m("Gửi", "Send"),
    reportThanks: m(
      "Mình nhận được rồi. Cảm ơn bạn.",
      "Got it. Thank you.",
    ),
    reportFailed: m(
      "Chưa gửi được. Bạn thử lại sau chút nhé.",
      "That didn't send. Try again shortly.",
    ),
  },

  /* ── Waiting list ───────────────────────────────────────────────────── */
  waitlist: {
    emailLabel: m("Email của bạn", "Your email"),
    emailPlaceholder: m("email@cua-ban.com", "you@example.com"),
    join: m("Tham gia", "Join"),
    joining: m("Đang gửi", "Sending"),
    joined: m(
      "Xong rồi. Có chỗ trống là mình báo bạn.",
      "You're on the list. We'll email when a place opens.",
    ),
    promptLabel: m("Danh sách chờ", "Waiting list"),
    promptTitle: m("Đây mới là bản demo", "This is a demo"),
    promptBody: m(
      "Bạn vừa thấy OpenPath làm được gì. Để lại email cho bản đầy đủ.",
      "You've seen what OpenPath does. Leave your email for the full version.",
    ),
    dismiss: m("Đóng lời mời", "Dismiss"),
  },

  /* ── Help ───────────────────────────────────────────────────────────── */
  help: {
    label: m("Trợ giúp", "Help"),
    askHowToUse: m("Hỏi Coach cách dùng OpenPath", "Ask the Coach how to use OpenPath"),
    askHowToUsePrompt: m(
      "OpenPath dùng thế nào? Chỉ mình những gì nên làm trước.",
      "How does OpenPath work? Tell me what to do first.",
    ),
    sendFeedback: m("Gửi góp ý", "Send feedback"),
    prototypeNote: m("OpenPath · bản prototype", "OpenPath · prototype"),
  },

  /* ── Errors and system messages ─────────────────────────────────────── */
  // Every one of these says what happened and what to do about it. The change
  // that mattered most: the failed-action toast used to print the raw Zod
  // validation message, which is a developer's sentence shown to a student.
  /* ── Papers: cover letters and project write-ups ────────────────────── */
  papers: {
    title: m("Thư và bài viết", "Letters and write-ups"),
    lead: m(
      "Thư xin việc và bài viết dự án, viết cùng Coach.",
      "Cover letters and project write-ups, written with the Coach.",
    ),
    newCoverLetter: m("Thư xin việc mới", "New cover letter"),
    newWriteUp: m("Bài viết dự án mới", "New project write-up"),
    untitled: m("Chưa đặt tên", "Untitled"),
    labelField: m("Tên văn bản", "Document name"),
    labelPlaceholder: m("Thư cho VNG", "Letter for VNG"),
    targetRoleField: m("Vị trí ứng tuyển", "Role you're applying for"),
    targetRolePlaceholder: m("Data Analyst", "Data Analyst"),
    paragraph: (n: number) => m(`Đoạn ${n}`, `Paragraph ${n}`),
    addParagraph: m("Thêm đoạn", "Add a paragraph"),
    moveUp: m("Đưa lên trên", "Move up"),
    moveDown: m("Đưa xuống dưới", "Move down"),
    removeParagraph: m("Xoá đoạn này", "Delete this paragraph"),
    paragraphPlaceholder: m("Viết đoạn này…", "Write this paragraph…"),
    // The empty state is the first thing most people see here, so it says what
    // to do rather than that there is nothing.
    emptyTitle: m("Chưa có văn bản nào", "Nothing written yet"),
    emptyBody: m(
      "Nhờ Coach viết bản nháp đầu, hoặc tự tạo rồi viết.",
      "Ask the Coach for a first draft, or start one yourself.",
    ),
    emptyDocument: m(
      "Văn bản này còn trống. Thêm đoạn đầu tiên bên dưới.",
      "This one is empty. Add the first paragraph below.",
    ),
    askCoach: m("Nhờ Coach viết nháp", "Ask the Coach to draft it"),
    // Sent to the Coach as if the user typed it, so it reads like a request.
    //
    // One entry per kind rather than one generic sentence, because "write a
    // draft of this document" tells the Coach nothing about what it is holding.
    // A cover letter and a project write-up want different shapes, and the
    // write-up's three parts are the difference between a story and a summary.
    // These are read in the *document's* language, not the app's, so an English
    // letter is asked for in English.
    askCoachLetter: m(
      "Viết giúp mình bản nháp thư xin việc này nhé.",
      "Write me a first draft of this cover letter.",
    ),
    askCoachLetterFor: (role: string) =>
      m(
        `Viết giúp mình bản nháp thư xin việc cho vị trí ${role} nhé.`,
        `Write me a first draft of a cover letter for the ${role} role.`,
      ),
    askCoachWriteUp: m(
      "Viết giúp mình bài viết dự án: dự án là gì, mình đã làm gì, kết quả ra sao.",
      "Draft this project write-up: what it was, what I did, what came of it.",
    ),
    count: (n: number) => m(`${n} văn bản`, n === 1 ? "1 document" : `${n} documents`),
  },

  /* ── Pitch: the bio, the introduction, the answer bank ──────────────── */
  pitch: {
    title: m("Giới thiệu bản thân", "Your pitch"),
    lead: m(
      "Những gì bạn nói về mình, chuẩn bị sẵn để dùng lại.",
      "What you say about yourself, ready to reuse.",
    ),
    bioTitle: m("Giới thiệu ngắn", "Online bio"),
    bioLead: m(
      "Đoạn ngắn để đăng lên LinkedIn hay hồ sơ trực tuyến.",
      "The short paragraph for LinkedIn or an online profile.",
    ),
    introTitle: m("Bài tự giới thiệu", "Self-introduction"),
    introLead: m(
      "Câu trả lời cho “Bạn giới thiệu về mình đi”.",
      "Your answer to “tell me about yourself”.",
    ),
    answersTitle: m("Câu trả lời phỏng vấn", "Interview answers"),
    answersLead: m(
      "Chuẩn bị trước những câu hay được hỏi.",
      "The questions you'll be asked, answered in advance.",
    ),
    questionField: m("Câu hỏi", "The question"),
    questionPlaceholder: m(
      "Điểm yếu của bạn là gì?",
      "What's your greatest weakness?",
    ),
    answerField: m("Câu trả lời của bạn", "Your answer"),
    answerPlaceholder: m("Viết câu trả lời…", "Write your answer…"),
    addAnswer: m("Thêm câu hỏi", "Add a question"),
    removeAnswer: m("Xoá câu này", "Delete this one"),
    bioPlaceholder: m("Viết vài dòng về bạn…", "A few lines about you…"),
    introPlaceholder: m("Viết bài tự giới thiệu…", "Write your introduction…"),
    emptyAnswers: m(
      "Chưa có câu nào. Thêm câu hỏi bạn sợ bị hỏi nhất.",
      "None yet. Start with the question you dread most.",
    ),
    askCoachBio: m("Nhờ Coach viết giới thiệu", "Ask the Coach to draft it"),
    askCoachIntro: m("Nhờ Coach viết bài này", "Ask the Coach to draft this"),
    askCoachBioPrompt: m(
      "Viết giúp mình đoạn giới thiệu ngắn dựa trên hồ sơ nhé.",
      "Draft my online bio from my profile.",
    ),
    askCoachIntroPrompt: m(
      "Viết giúp mình bài tự giới thiệu dựa trên hồ sơ và mục tiêu nhé.",
      "Draft my self-introduction from my profile and my goal.",
    ),
    notWrittenYet: m("Chưa viết", "Not written yet"),
  },

  /* ── Accounts ───────────────────────────────────────────────────────── */
  // The first words most people read after the landing page. Two rules the
  // rest of this catalog already follows matter more than usual here: the
  // buttons name the action rather than saying "Submit", and every error is
  // an instruction placed beside the field that failed.
  //
  // What is deliberately absent: any promise about recovering a forgotten
  // password. There is no recovery this phase, so the copy does not imply one.
  auth: {
    signInTitle: m("Đăng nhập", "Sign in"),
    signInLead: m(
      "Đăng nhập để xem lại phần bạn đang làm.",
      "Sign in to pick up where you left off.",
    ),
    signUpTitle: m("Tạo tài khoản", "Create an account"),
    signUpLead: m(
      "Tạo tài khoản để giữ lại phần bạn làm.",
      "Create an account and your work is saved.",
    ),
    username: m("Tên đăng nhập", "Username"),
    password: m("Mật khẩu", "Password"),
    // Said before they type, not after they get it wrong.
    passwordHint: m("Ít nhất 8 ký tự.", "At least 8 characters."),
    signIn: m("Đăng nhập", "Sign in"),
    signingIn: m("Đang đăng nhập", "Signing in"),
    signUp: m("Tạo tài khoản", "Create account"),
    signingUp: m("Đang tạo tài khoản", "Creating your account"),
    signOut: m("Đăng xuất", "Sign out"),
    noAccountYet: m("Chưa có tài khoản?", "No account yet?"),
    haveAccount: m("Đã có tài khoản?", "Already have an account?"),
    // No recovery exists, so this says what to do instead of offering a link
    // that goes nowhere.
    forgotNote: m(
      "Chưa có cách khôi phục mật khẩu, bạn nhớ giữ kỹ nhé.",
      "There's no password reset yet, so keep yours somewhere safe.",
    ),
  },

  // What the guards say when they stop something. Written as the Coach would
  // say it, not as a system: the user is talking to a person, and a refusal
  // that suddenly reads like a firewall log tells them the person was never
  // there. Each one says what it will not do and offers what it will.
  guardrails: {
    injectionRefused: m(
      "Câu này bảo mình bỏ qua hướng dẫn của mình, nên mình không làm theo.",
      "That asks me to ignore my own instructions, so I won't.",
    ),
    outOfScope: m(
      "Mình không tư vấn pháp lý, y tế hay tài chính. Về nghề nghiệp thì mình giúp được.",
      "I don't give legal, medical or financial advice. On your career, I can help.",
    ),
    sensitiveRemoved: m(
      "Mình đã bỏ số giấy tờ trong tin nhắn. Hồ sơ xin việc không cần nó.",
      "I removed the ID number from your message. A job application doesn't need it.",
    ),
    overBudget: m(
      "Cuộc trò chuyện này dài quá rồi. Bạn mở một cuộc mới nhé.",
      "This conversation has got too long. Start a new one.",
    ),
    // Appended to a reply that claimed a change with nothing to back it up.
    // Blunt on purpose: the user is about to open a screen and find it
    // unchanged, and hearing it here is better than finding it there.
    noActionTaken: m(
      "Đính chính: mình chưa thay đổi gì cả. Bạn nhắc lại để mình làm nhé.",
      "Correction: I didn't actually change anything. Ask me again and I'll do it.",
    ),
    // Said when a reply carries a number or a fact the profile does not.
    // Naming it rather than deleting it: the user is the only one who knows
    // whether it is true, and they are about to use it in an interview.
    notGrounded: m(
      "Có chi tiết ở trên mình lấy từ đâu không rõ. Bạn kiểm lại trước khi dùng nhé.",
      "Something above isn't in your profile. Check it before you use it.",
    ),
  },

  errors: {
    // The account failures. Each one names what to do, and the one for bad
    // credentials deliberately does not say which field was wrong: telling
    // somebody the username exists is most of the work of breaking into it.
    authUsernameRequired: m(
      "Bạn nhập tên đăng nhập nhé.",
      "Enter a username.",
    ),
    authPasswordRequired: m("Bạn nhập mật khẩu nhé.", "Enter a password."),
    authUsernameTaken: m(
      "Tên này có người dùng rồi. Bạn chọn tên khác nhé.",
      "That username is taken. Pick another one.",
    ),
    authUsernameTooLong: m("Tên này dài quá.", "That username is too long."),
    authPasswordTooShort: m(
      "Mật khẩu cần từ 8 đến 72 ký tự.",
      "Use between 8 and 72 characters.",
    ),
    authBadCredentials: m(
      "Tên đăng nhập hoặc mật khẩu chưa đúng.",
      "That username and password don't match.",
    ),
    authRateLimited: m(
      "Bạn thử hơi nhiều lần. Đợi một phút rồi thử lại.",
      "Too many tries. Wait a minute and try again.",
    ),
    authStoreDown: m(
      "Chưa xử lý được. Thử lại sau chút nhé.",
      "That didn't go through. Try again shortly.",
    ),
    authOffline: m(
      "Không kết nối được. Kiểm tra mạng rồi thử lại.",
      "No connection. Check your network and try again.",
    ),

    actionFailedTitle: m("Chưa thực hiện được thay đổi", "That change didn't go through"),
    actionFailedBody: m(
      "Không có gì bị mất. Bạn thử lại nhé.",
      "Nothing was lost. Try again.",
    ),
    storageFailedTitle: m("Chưa lưu được thay đổi", "Your changes aren't being saved"),
    storageFailedBody: m(
      "Thay đổi sẽ mất khi bạn tải lại trang. Thử tắt chế độ ẩn danh.",
      "This will be gone when you reload. Try leaving private browsing.",
    ),
    waitlistEmailEmpty: m(
      "Bạn nhập email giúp mình nhé.",
      "Enter your email to join.",
    ),
    waitlistEmailShape: m(
      "Email chưa đúng định dạng.",
      "That doesn't look like an email address.",
    ),
    waitlistEmailTooLong: m(
      "Email này dài quá.",
      "That email is too long.",
    ),
    waitlistBadRequest: m(
      "Chưa gửi được. Tải lại trang rồi thử lại.",
      "That didn't send. Reload and try again.",
    ),
    waitlistRateLimited: m(
      "Bạn gửi hơi nhanh. Thử lại sau một phút.",
      "Too many tries. Wait a minute.",
    ),
    waitlistStoreDown: m(
      "Chưa lưu được. Thử lại sau chút nhé.",
      "Couldn't save that. Try again shortly.",
    ),
    waitlistOffline: m(
      "Không kết nối được. Kiểm tra mạng rồi thử lại.",
      "No connection. Check your network and try again.",
    ),
  },
} as const;

/** Read one entry in the given language. */
export function translate(entry: Msg, locale: keyof Msg): string {
  return entry[locale];
}
