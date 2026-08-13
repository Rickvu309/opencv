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
    todo: m("Việc cần làm", "Tasks"),
    career: m("Sự nghiệp", "Career"),
    profile: m("Hồ sơ", "Profile"),
    cv: m("CV", "CV"),
    map: m("Bản đồ hướng đi", "Career map"),
    plan: m("Kế hoạch", "Plan"),
    // One name for one destination. This link used to be "Cập nhật thông tin"
    // in the account menu and "Làm lại onboarding" in the help menu, which read
    // as two different places.
    editProfileDetails: m("Cập nhật thông tin của bạn", "Update your details"),
    yourProfile: m("Hồ sơ của bạn", "Your profile"),
    noGoalYet: m("Chưa đặt mục tiêu", "No goal set yet"),
  },

  /* ── Landing ────────────────────────────────────────────────────────── */
  landing: {
    // Three short declarations, one per line at every width. The English is
    // three imperatives rather than a rendering of the Vietnamese nouns.
    headline1: m("Hiểu bản thân.", "Know your strengths."),
    headline2: m("Chọn đúng hướng.", "Pick a real direction."),
    headline3: m("Biết bắt đầu từ đâu.", "Take the first step."),
    subhead: m(
      "Cố vấn nghề nghiệp cho người trẻ Việt, dựa trên hồ sơ thật của bạn.",
      "A career coach for Vietnamese students, built on your real profile.",
    ),
    tryIt: m("Dùng thử OpenPath", "Try OpenPath"),
    joinWaitlist: m("Tham gia danh sách chờ", "Join the waiting list"),
    waitlistLead: m(
      "Có chỗ trống là mình báo bạn ngay.",
      "We'll email you when a place opens.",
    ),
    alreadyJoined: m(
      "Bạn đã ở trong danh sách chờ. Cứ dùng thử trong lúc đợi.",
      "You're on the list. Look around while you wait.",
    ),
    feature1: m("Hiểu bản thân", "Understand yourself"),
    feature2: m("Cơ hội phù hợp", "Roles that fit"),
    feature3: m("Lộ trình rõ ràng", "A plan you can follow"),
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
    // The four role blurbs that used to live here are gone: the roles are read
    // from the career map now, and every one of them already carries its own
    // summary and pay band written once, in lib/career-graph.ts.
    rolePickHint: m(
      "Hoặc chọn một vai trò trên bản đồ hướng đi:",
      "Or pick a role from the career map:",
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

    signInTitle: m(
      "Đăng nhập để trò chuyện với Coach",
      "Sign in to talk to the Coach",
    ),
    signInBody: m(
      "Bản demo dùng chung một tài khoản. Mật khẩu ở ngay dưới.",
      "One shared account for this demo. The password is below.",
    ),
    email: m("Email", "Email"),
    password: m("Mật khẩu", "Password"),
    signIn: m("Đăng nhập", "Sign in"),
    signingIn: m("Đang kiểm tra", "Checking"),
    demoAccount: m("Tài khoản demo", "Demo account"),
    signInMissingFields: m(
      "Nhập email và mật khẩu để tiếp tục.",
      "Enter your email and password to continue.",
    ),
    signInWrong: m(
      "Email hoặc mật khẩu chưa đúng.",
      "That email and password don't match.",
    ),
    signInUnreachable: m(
      "Chưa kết nối được tới Coach. Thử lại sau chút nhé.",
      "Can't reach the Coach. Try again shortly.",
    ),
    sessionExpired: m(
      "Phiên đăng nhập đã hết. Đăng nhập lại nhé.",
      "Session expired. Sign in again.",
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
    template: m("Mẫu", "Template"),
    templateClassic: m("Cổ điển", "Classic"),
    templateModern: m("Hiện đại", "Modern"),
    templateCompact: m("Gọn", "Compact"),
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

  /* ── Career map ─────────────────────────────────────────────────────── */
  map: {
    intro: m(
      "Từ hôm nay tới các vai trò bạn có thể tới. Kéo để xem, bấm để mở chi tiết.",
      "From where you are to where you could go. Drag to explore, select a role for detail.",
    ),
    youToday: m("Bạn hôm nay", "You today"),
    zoomIn: m("Phóng to", "Zoom in"),
    zoomOut: m("Thu nhỏ", "Zoom out"),
    fit: m("Vừa khung", "Fit to screen"),
    requirementMet: m("Đã đạt", "Met"),
    requirementMissing: m("Chưa đạt", "Not yet"),
    legendRoute: m("Đường tới mục tiêu", "Route to your goal"),
    legendFit: m("Độ phù hợp", "Fit"),
    goal: m("Mục tiêu", "Goal"),
    addPath: m("Thêm hướng đi", "Add a direction"),
    addPathRoleName: m("Tên vai trò", "Role name"),
    addPathRolePlaceholder: m("VD: Data Scientist", "e.g. Data Scientist"),
    addPathColumn: m("Nằm ở cột", "Which column"),
    addPathFrom: (title: string) =>
      m(
        `Nối từ ${title}. Chọn nút khác để đổi điểm nối.`,
        `Connects from ${title}. Select another role to change that.`,
      ),
    addPathSubmit: m("Thêm vào sơ đồ", "Add to the map"),
    detailOf: (title: string) => m(`Chi tiết ${title}`, `About ${title}`),
    closeDetail: m("Đóng chi tiết", "Close detail"),
    fitScore: m("Độ phù hợp", "Fit"),
    salary: m("Lương tham khảo", "Typical pay"),
    youHave: m("Bạn đang có", "What you have"),
    roleDoes: m("Bạn sẽ làm gì", "What you'd do"),
    roleRequires: m("Cần có để bước vào", "What it takes to get in"),
    comesFrom: m("Đến từ", "Reached from"),
    leadsTo: m("Từ đây đi tiếp", "Leads on to"),
    setAsGoal: m("Đặt làm mục tiêu", "Set as my goal"),
    isGoal: m("Đang là mục tiêu của bạn", "Your goal"),
    onRoute: m(
      "Vai trò này nằm trên đường tới mục tiêu của bạn.",
      "This role is on the route to your goal.",
    ),
    removeFromMap: m("Xoá khỏi sơ đồ", "Remove from the map"),
    askAboutRole: m("Hỏi Coach về hướng này", "Ask the Coach about this"),
    askAboutYouPrompt: m(
      "Nhìn hồ sơ hiện tại, mình hợp với hướng đi nào nhất?",
      "Looking at my profile, which direction suits me best?",
    ),
    askAboutRolePrompt: (title: string) =>
      m(
        `Mình cần gì để đi tới vai trò ${title}?`,
        `What would it take for me to reach ${title}?`,
      ),
    goalSet: (title: string) =>
      m(`Đã đặt ${title} làm mục tiêu`, `${title} is now your goal`),
    goalSetBody: m(
      "Mọi đường tới đích đang sáng trên sơ đồ.",
      "Every route there is now lit.",
    ),
    added: (title: string) => m(`Đã thêm ${title}`, `Added ${title}`),
    addedBody: m(
      "Kéo để đặt lại vị trí, hoặc nhờ Coach đánh giá.",
      "Drag to reposition, or ask the Coach what they think.",
    ),
  },

  /* ── Plan ───────────────────────────────────────────────────────────── */
  plan: {
    titleWithRole: (role: string) => m(`Lộ trình tới ${role}`, `Your route to ${role}`),
    title: m("Lộ trình của bạn", "Your route"),
    progress: (done: number, total: number, percent: number) =>
      m(
        `${done}/${total} việc · hoàn thành ${percent}%`,
        `${done} of ${total} done · ${percent}% complete`,
      ),
    intro: m(
      "Mỗi việc một dòng. Mở mũi tên để xem chi tiết và học phí.",
      "One line per task. Open the arrow for detail and cost.",
    ),
    stageEmpty: m(
      "Chưa có việc nào. Nhờ Coach thêm giúp bạn.",
      "Nothing here yet. Ask the Coach to fill it in.",
    ),
    viewMap: m("Mở bản đồ hướng đi", "Open the career map"),
    askCoachToReview: m("Nhờ Coach xem lại kế hoạch", "Ask the Coach to review this"),
    reviewPromptWithRole: (role: string) =>
      m(
        `Kế hoạch tới ${role} của mình có gì cần điều chỉnh không?`,
        `Anything you'd change about my plan for ${role}?`,
      ),
    reviewPrompt: m(
      "Kế hoạch hiện tại của mình có gì cần điều chỉnh không?",
      "Anything you'd change about my current plan?",
    ),
    markDone: (title: string) => m(`Đánh dấu xong: ${title}`, `Mark done: ${title}`),
    showDetail: (title: string) => m(`Xem chi tiết ${title}`, `Show detail for ${title}`),
    hideDetail: (title: string) => m(`Ẩn chi tiết ${title}`, `Hide detail for ${title}`),
    openCourse: m("Mở khoá học", "Open the course"),
    partner: m("Đối tác", "Partner"),
    removeFromPlan: m("Xoá khỏi kế hoạch", "Remove from the plan"),
    kindCourse: m("Khoá học", "Course"),
    kindProject: m("Dự án", "Project"),
    kindTask: m("Việc làm đều", "Habit"),
  },

  /* ── Tasks ──────────────────────────────────────────────────────────── */
  todo: {
    heading: m("Việc cần làm", "Tasks"),
    addPlaceholder: m("Thêm việc…", "Add a task…"),
    addLabel: m("Thêm việc", "Add a task"),
    filterBySource: m("Lọc theo nguồn", "Filter by source"),
    sourceHeading: m("Nguồn việc", "Source"),
    displayOptions: m("Tuỳ chọn hiển thị", "Display options"),
    showDone: m("Hiện việc đã xong", "Show completed tasks"),
    doneCount: (n: number) => m(`Đã xong · ${n}`, `Done · ${n}`),
    sourcePlan: m("Kế hoạch", "Plan"),
    sourceCoach: m("Coach", "Coach"),
    sourceSelf: m("Bạn thêm", "Added by you"),
    // Two different emptinesses. Calling both "no tasks match these filters"
    // told someone with a brand-new account that a filter they never set was
    // hiding work they never had.
    emptyTitle: m("Chưa có việc nào", "No tasks yet"),
    filterEmptyTitle: m(
      "Không có việc nào khớp bộ lọc",
      "No tasks match these filters",
    ),
    filterEmptyAll: m(
      "Thêm việc ở ô trên, hoặc nhờ Coach gợi ý.",
      "Add one above, or ask the Coach what to do next.",
    ),
    filterEmptyFiltered: m(
      "Bỏ bớt bộ lọc để xem lại tất cả.",
      "Clear a filter to see everything.",
    ),
    showAllSources: m("Hiện tất cả", "Show all"),
    noSelectionTitle: m("Chưa chọn việc nào", "No task selected"),
    noSelectionBody: m(
      "Chọn một việc bên trái, hoặc thêm việc mới ở ô trên.",
      "Pick a task on the left, or add one above.",
    ),
    detailTitle: m("Chi tiết việc", "Task detail"),
    markDone: m("Đánh dấu xong", "Mark as done"),
    markNotDone: m("Bỏ đánh dấu", "Mark as not done"),
    fieldSource: m("Nguồn", "Source"),
    fieldStage: m("Giai đoạn", "Stage"),
    fieldEffort: m("Thời lượng", "Time needed"),
    fieldResource: m("Tài nguyên", "Resource"),
    askCoach: m("Hỏi Coach về việc này", "Ask the Coach about this task"),
    askCoachPrompt: (title: string) =>
      m(`Giúp mình bắt đầu việc: ${title}`, `Help me get started on: ${title}`),
    openInPlan: m("Mở trong kế hoạch", "Open in the plan"),
    completed: (title: string) => m(`Đã xong: ${title}`, `Done: ${title}`),
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
  errors: {
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
