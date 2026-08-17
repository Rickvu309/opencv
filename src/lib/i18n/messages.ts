// Every word the product says.
//
// ## Why a catalog rather than strings in place
//
// The same idea was worded three different ways across three screens, which is
// invisible while the copy is scattered and obvious the moment it sits in one
// list.
//
// ## Rules the entries follow
//
// - **Buttons start with a verb** naming the action. Never "OK", never "Yes"
//   on anything consequential; a confirmation repeats what it will do.
// - **Sentence case everywhere.** Title Case On Buttons next to sentence case
//   in headings reads as sloppiness.
// - **Errors are instructions**, placed next to what failed. No "Oops", no
//   exclamation marks, no blame.
// - **Counts are templated**, never concatenated around a number.
// - **Links name their destination.** No bare "Learn more".
//
// ## Voice
//
// `PRODUCT.md`: a good older mentor. Encouraging, never flattering, willing to
// say the distance is long. Second person, contractions allowed, no
// exclamation marks, none of the startup cheerfulness.

import type { Msg } from "./locale";

/** Shorthand so an entry reads as one line rather than four. */
const m = (en: string): Msg => en;

export const messages = {
  /* ── Shared vocabulary ──────────────────────────────────────────────── */
  // One name per action, used everywhere that action appears. This block is
  // the reason Save and Save changes cannot drift apart again.
  common: {
    save: m("Save changes"),
    cancel: m("Cancel"),
    edit: m("Edit"),
    delete: m("Delete"),
    add: m("Add"),
    close: m("Close"),
    undo: m("Undo"),
    optional: m("optional"),
    notAddedYet: m("Not added yet"),
    added: m("added"),
    missing: m("not added"),
    language: m("Language"),
    loading: m("Loading"),
    search: m("Search"),
    openSidebar: m("Open sidebar"),
    toggleSidebar: m("Toggle sidebar"),
    resizeSidebar: m("Drag to resize the sidebar, double-click to close"),
    skipToContent: m("Skip to main content"),
    signIn: m("Sign in"),
    commandPalette: m("Go to…"),
    commandHint: m("Type to filter"),
    moveUp: m("Move up"),
    moveDown: m("Move down"),
    explain: (title: string) => m(`About ${title}`),
  },

  /* ── Profile context rows ───────────────────────────────────────────── */
  // These are both interface copy and stored data: a context row is keyed by
  // its label. Lookups use `matchesMsg` so an older stored label still matches.
  context: {
    gender: m("Gender"),
    birthYear: m("Year of birth"),
    certainty: m("How settled on the goal"),
    location: m("Location"),
  },

  /* ── Navigation ─────────────────────────────────────────────────────── */
  nav: {
    coach: m("Coach"),
    // Names the conversation list in the rail, not a destination. Coach is
    // the destination; this only labels the threads that fill leftover height.
    chats: m("Chats"),
    // The two pillars, in student words. Prepare Yourself / My Kit is not its
    // own screen; this label groups Paper and Pitch. Land the Right
    // Opportunity groups search then applications. Profile lives in the
    // account menu, not this rail.
    prepare: m("Prepare"),
    land: m("Opportunities"),
    profile: m("Profile"),
    // The artefact. CV and letter are types of paper, not extra screens.
    paper: m("My Paper"),
    // 8090 name. "Your pitch" put the product in the second person; the
    // feature is something the user owns.
    pitch: m("My Pitch"),
    // The action, not the objects. "Openings" / "Việc đang tuyển" named the
    // listings; this is the screen where you look.
    search: m("Search"),
    applications: m("Applications"),
    billing: m("Plan and billing"),
    support: m("Help"),
    // One name for one destination. This link used to be "Cập nhật thông tin"
    // in the account menu and "Làm lại onboarding" in the help menu, which read
    // as two different places.
    editProfileDetails: m("Update your details"),
    yourProfile: m("Your profile"),
    noGoalYet: m("No goal set yet"),
  },

  /* ── Landing ────────────────────────────────────────────────────────── */
  landing: {
    audience: m("For students and new graduates"),
    headline: m("A career coach that starts from you."),
    headlineNext: m("You don't need a plan to begin."),
    subhead: m("Talk about where you are. The Coach helps you see what fits."),
    createAccount: m("Create an account"),
    haveAccount: m("Already have an account?"),
    signIn: m("Sign in"),
    footerNote: m("Your work is saved to an account."),
  },

  /* ── Onboarding ─────────────────────────────────────────────────────── */
  onboarding: {
    // One screen, once, at sign-up. A name, a direction (or not sure), and an
    // optional CV. School, courses and the rest wait until the Coach asks.
    beforeCoach: m("Before you meet the Coach"),
    roleWanted: m("The role you want"),
    cvYours: m("Your CV"),
    cvLead: m("Upload the file you already have. It is stored on My Paper, not parsed."),
    cvDrop: m("Drop a CV, or choose a file."),
    cvNone: m("No CV yet. The Coach will build one with you."),
    removeFile: m("Remove file"),

    stepOf: (step: number, total: number) =>
      m(`Step ${step} of ${total}`),
    privacy: m("Only used to shape your advice. Change it any time."),
    backStep: m("Back to the previous step"),

    // Three screens, goal first. The old four asked for gender and year of
    // birth before anything else and put the goal last, which is the one
    // question the visitor actually arrived with.
    step1Label: m("Your goal"),
    startLabel: m("Your start"),
    haveLabel: m("What you have"),

    goalHeadline: m("What are you aiming at?"),
    goalSupport: m("One question. Then you talk to the Coach."),
    goalNext: m("Continue · Your start"),

    unsureTitle: m("I'm not sure yet"),
    unsureNote: m("The Coach will help find the nearest fit."),
    otherRole: m("Or name another role"),

    startHeadline: m("Where are you starting from?"),
    startSupport: m("Three questions. The number below moves with each answer."),
    startNext: m("Continue · What you have"),

    haveHeadline: m("What have you got already?"),
    haveSupport: m("Courses, certificates, skills. One per line."),
    finishNext: m("Talk to the Coach"),

    knownDirection: (role: string) =>
      m(`A direction we know: ${role}. The Coach will read it against your real profile.`),
    writtenDirection: m("We'll keep the words you typed. The Coach will ask if more is needed."),

    fitFor: m("How close you are"),

    // The guided tour. Four cards, in the order somebody meets the product:
    // who does the work, where their materials live, how jobs are found, and
    // the promise that makes the first card acceptable.
    tourSkip: m("Skip"),
    tourNext: m("Next"),
    tourDone: m("Done, meet the Coach"),
    tourStep: (at: number, of: number) => m(`${at} of ${of}`),
    tour1Title: m("The Coach works with you"),
    tour1Body: m("Not just advice. Ask once and the Coach writes your CV or edits a letter, here."),
    tour2Title: m("You stay in control"),
    tour2Body: m("Every change shows a card with an undo button. Deletions ask first. Nothing happens behind your back."),
    tour3Title: m("Where your materials live"),
    tour3Body: m("CVs and letters live together. Your pitch has its own screen. Edit any of it by hand."),
    tour4Title: m("Find jobs and track them"),
    tour4Body: m("Paste a posting and see what you're missing. Then track it to an outcome."),

    // The activation checklist.
    checklistTitle: m("Your first four"),
    checklistLead: m("Do these four and you've used the whole product."),
    stepGoal: m("Set a career goal"),
    stepFacts: m("Add a course or an experience"),
    stepDocument: m("Make something: a CV, a letter, or a pitch"),
    stepCoach: m("Talk to the Coach once"),
    // These two moved here from the career map when it was retired. The live
    // fit score outlived the map, and so did the words it needs.
    requirementMet: m("Met"),
    requirementMissing: m("Not yet"),
    fitClosest: m("Right now you're closest to"),
    fitNote: m("This is a starting line, not a verdict. The Coach helps you close it."),

    name: m("Full name"),
    gender: m("Gender"),
    genderPlaceholder: m("Select gender"),
    genderFemale: m("Female"),
    genderMale: m("Male"),
    genderOther: m("Other"),
    birthYear: m("Year of birth"),
    school: m("School"),
    major: m("Field of study"),
    year: m("Year of study"),
    yearPlaceholder: m("Select year"),
    year1: m("First year"),
    year2: m("Second year"),
    year3: m("Third year"),
    year4: m("Fourth year"),
    graduated: m("Graduated"),
    gpa: m("GPA"),
    gpaPlaceholder: m("e.g. 3.4/4.0"),
    courses: m("Courses and certificates"),
    coursesPlaceholder: m("One per line, for example:\nGoogle Data Analytics (Coursera)\nIELTS 6.5"),
    linkedin: m("LinkedIn URL"),
    linkedinPlaceholder: m("linkedin.com/in/your-name"),
    cvFileName: m("CV file name"),
    cvFileNamePlaceholder: m("Your_Name_CV.pdf"),
    targetRole: m("The job you're aiming for"),
    targetRolePlaceholder: m("Data Analyst"),
    certainty: m("How settled are you on this direction?"),
    certaintySure: m("Settled"),
    certaintySureNote: m("I've looked into it and I'm going this way."),
    certaintyLeaning: m("Leaning that way"),
    certaintyLeaningNote: m("I'm leaning this way but still comparing."),
    certaintyUnsure: m("Still deciding"),
    certaintyUnsureNote: m("I'm weighing up several options."),
    certaintyReassure: m("Not sure? That's what the Coach is for."),
    // The four role blurbs that used to live here are gone: each role carries
    // its own summary and pay band, written once in lib/catalogue/graph.ts.
    rolePickHint: m("Or pick a role:"),

    // Honest about what is happening. The old screen showed a spinner and
    // "AI đang phân tích hồ sơ…" for 1.8 seconds while nothing was analysed;
    // a product whose first principle is evidence over encouragement cannot
    // open by inventing work it did not do.
    savingTitle: m("Saved, thank you"),
    savingSupport: m("Saving your profile, then taking you to the Coach."),
    savingStatus: m("Saving your profile…"),

    // The first Coach turn after setup. Names the goal they just chose, or
    // admits they have not, so the first answer is not generic.
    firstQuestionUnsure: m("I don't know which direction fits. Where should I start?"),
    firstQuestionForRole: (role: string) =>
      m(`I want to be a ${role}. What should I do first?`),
    asideCoachHint: m("School, courses, experience — the Coach asks when it needs them."),
    previewEmpty: m("Not filled in yet"),
  },

  /* ── Coach ──────────────────────────────────────────────────────────── */
  coach: {
    newChat: m("New chat"),
    ongoingChat: m("Current chat"),
    startNewChat: m("Start a new chat"),
    openFullScreen: m("Open full screen"),
    minimise: m("Minimise"),
    hideRecent: m("Hide recent chat"),
    composerPlaceholder: m("Ask the Coach…"),
    startersLabel: m("Suggestions"),
    // Shown in the composer, cycling. The field's accessible name stays
    // "Hỏi Coach…"; these are examples of what to type, picked from the
    // screen you are on and from the same state the suggestions read.
    hintCv: m("What's still missing on this page?"),
    hintPitch: m("Draft my self-introduction"),
    hintSearch: m("How well do I fit this posting?"),
    hintApplications: m("What's next on this application?"),
    hintProfile: m("What should I add to my profile?"),
    send: m("Send message"),
    composerAdd: m("Add"),
    slashEmpty: m("No matching suggestions"),
    typing: m("The Coach is answering"),
    stop: m("Stop answering"),

    // The reasoning panel. The model thinks before it answers, and on a plain
    // question that is most of the minute the user spends waiting.
    thinking: m("The Coach is thinking…"),
    thoughtFor: (seconds: number) =>
      m(`Thought for ${seconds}s`),
    thoughtBriefly: m("Thought for a moment"),

    // A tool call, at each point of its life. Only the success line comes from
    // the registry's own summary; these cover the states that have no summary
    // because nothing landed.
    toolRunning: m("Making the change…"),
    toolFailed: m("Nothing was changed"),
    toolDenied: m("You declined this change"),
    toolChanges: (n: number) =>
      m(n === 1 ? "1 change" : `${n} changes`),
    jumpToLatest: m("Jump to latest"),
    approvalTitle: m("Needs your confirmation"),
    openCv: m("Open this CV"),
    openPaper: m("Open"),
    deleteChat: m("Delete this chat"),
    switchChat: m("Switch conversation"),
    limitTitle: m("This conversation is full"),
    limitBody: m("Start a new one to carry on. This one is kept."),
    // Empty canvas. The box sits above this; the line is dry on
    // purpose, not a mascot caption. The named form keeps the same two beats.
    readyWithName: (name: string) =>
      m(`Still listening, ${name}. No rush.`),
    ready: m("Still listening. No rush."),
    answerInComposer: m("Or answer in your own words below."),

    // Chosen from state by lib/coach/starters.ts, six at a time. They used to
    // be four fixed lines, which meant the app offered to build a CV to someone
    // who had built three, and asked which direction suits you to someone who
    // had already named one.
    starterBuildCv: m("Build a CV from my profile"),
    starterTailorCv: m("Tailor my CV for a specific role"),
    starterWhereToStart: m("Where should I start?"),
    starterPrioritise: m("What should I do first this week?"),
    starterGapForRole: (role: string) =>
      m(`What's missing for ${role}?`),
    starterWhichDirection: m("Which direction suits me best?"),
    starterNoExperience: m("How do I write a CV with no experience?"),
    starterFillProfile: m("Help me finish my profile"),
    starterMarketGap: m("How does my profile compare to the market?"),
    starterWriteLetter: m("Write a cover letter from my profile"),
    starterReviewLetter: m("Review my cover letter"),
    starterFindOpenings: m("Find openings that fit me"),
    starterWritePitch: m("Help me write my pitch"),
    starterFollowUp: m("How do I follow up on an application?"),

    offlineTitle: m("The Coach is offline"),
    offlineBody: m("Ask again to retry the connection."),
    backOnline: m("The Coach is back"),
    emptyTurn: m("That didn't come through. Ask me again."),

    // The Coach's own sign-in is gone. It collected a shared demo password,
    // printed under the form, which was the whole tenancy story of that phase.
    // The agent now answers to the account, so the only thing left to say is
    // that the session ended, and where the way back is.
    sessionEndedTitle: m("Your session has ended"),
    sessionEndedBody: m("Sign in again to pick this conversation back up."),
  },

  /* ── Profile ────────────────────────────────────────────────────────── */
  profile: {
    sections: m("Profile sections"),
    allSections: m("All sections"),
    completeness: m("Profile complete"),
    groupSelf: m("About you"),
    groupDocuments: m("Documents"),
    missingCount: (n: number) =>
      m(n === 1 ? "1 section to add" : `${n} sections to add`),
    itemCount: (n: number) => m(n === 1 ? "1 entry" : `${n} entries`),
    versionCount: (n: number) =>
      m(n === 1 ? "1 version" : `${n} versions`),

    identity: m("Personal details"),
    fullName: m("Full name"),
    aimingFor: m("Aiming for"),
    targetRole: m("Role you're aiming for"),
    identityHint: m("Your name and the role you want."),
    identityNameRequired: m("Enter your name to save."),
    identityRoleRequired: m("Enter your target role to save."),

    context: m("Situation and goals"),
    contextHint: m("Where you are now, so advice can fit."),
    contextNeedOne: m("Fill in at least one row to save."),
    contextValueRequired: (label: string) =>
      m(`Fill in “${label}” to save.`),
    contextGenderPlaceholder: m("Woman"),
    contextBirthYearPlaceholder: m("2003"),
    contextCertaintyPlaceholder: m("Still exploring"),
    contextLocationPlaceholder: m("Hanoi"),

    experience: m("Experience"),
    experienceRole: m("Role"),
    experienceOrg: m("Organisation"),
    experiencePeriod: m("Dates"),
    experienceDetail: m("What you did"),
    experienceEntry: (n: number) => m(`Entry ${n}`),
    experienceRemove: m("Remove this entry"),
    experienceAdd: m("Add experience"),
    experienceRequired: m("Every entry needs a role and an organisation."),
    experienceEmptyTitle: m("No experience added yet"),
    experienceEmptyBody: m("Internships, clubs and coursework all count. The Coach reads this."),

    education: m("Education and certificates"),
    educationHint: m("School and field of study. Add courses after."),
    school: m("School"),
    major: m("Field of study"),
    yearAndGpa: m("Year"),
    schoolRequired: m("Enter your school to save."),
    certificates: m("Certificates and courses"),
    addCertificate: m("Add a certificate"),
    certificatePlaceholder: m("Google Data Analytics (Coursera)"),
    removeCertificate: (name: string) =>
      m(`Remove ${name}`),

    docEmptyTitle: (kind: string) =>
      m(`No ${kind.toLowerCase()} yet`),
    docBuildCv: m("Build a CV here"),
    docBuildLetter: m("Write a letter here"),
    docUploadExisting: m("Upload an existing CV"),
    docAddFile: m("Add an existing file"),
    docAskCoach: m("Ask the Coach to review"),
    docAddVersion: m("Add a version"),
    docPrimary: m("Primary"),
    docIsPrimary: (label: string) =>
      m(`${label} is primary`),
    docMakePrimary: (label: string) =>
      m(`Make ${label} primary`),
    docPrimaryHint: m("Primary. The Coach reads this one"),
    docSetPrimary: m("Make primary"),
    docEdit: (label: string) => m(`Edit ${label}`),
    docRemove: (label: string) => m(`Delete ${label}`),
    docSync: (label: string) => m(`Sync ${label}`),
    docResync: m("Sync again"),
    docUpdatedAt: (when: string) => m(`Updated ${when}`),
    docSyncedAt: (when: string) => m(`Synced ${when}`),
    docNeverSynced: m("Never synced"),

    docFormLabel: m("Name this version"),
    docFormLabelHint: m("Name it after the job it's for."),
    docFormPurpose: m("What it's for"),
    docFormPurposeFor: (role: string) =>
      m(`Applying for ${role} roles`),
    docFormPurposePlaceholder: m("Junior Data Analyst roles in fintech"),
    docFormRole: m("Target role"),
    docFormLanguage: m("Language"),
    docFormUrl: m("Link"),
    docFormUrlHint: m("The Coach re-reads this link each time you sync."),
    docFormFile: m("File name"),
    docFormUrlAlt: m("Or paste a link"),
    docFormNote: m("Note for the Coach"),
    docFormNotePlaceholder: m("Drops the marketing internship, leads with data projects."),
    docFormMakePrimary: m("Make this primary"),
    docFormMakePrimaryHint: m("The Coach reads this one, and it shows first."),
    docFormSave: m("Save changes"),
    docFormAdd: m("Add to profile"),
    docFormNeedLabel: m("Name this version to save it."),
    docFormNeedUrl: m("Paste a link to save it."),
    docFormNeedSource: m("Add a file name or a link to save it."),
  },

  /* ── Paper: CVs, letters, and Proofs in one list ────────────────── */
  paper: {

    emptyTitle: m("Start with the CV."),
    emptyWithProfile: m("Pick where it's going. Letters and Proofs can come after."),
    emptyWithoutProfile: m("Pick where it's going. Letters and Proofs can come after."),
    emptyUploadsOnly: m("This file is here. A built CV is what you can tailor."),
    alreadyHaveFile: m("I already have a file"),
    startCvFromFile: m("Start a CV from this"),
    uploadStartHint: m("This file is your start. You write on the paper."),
    filterByType: m("Filter by type"),
    newDocument: m("New"),
    kindCv: m("CV"),
    kindResume: m("Resume"),
    kindLetter: m("Cover letter"),
    kindProof: m("Proof"),
    kindUploaded: m("Uploaded"),
    yourDocuments: m("My Paper"),
    documentCount: (n: number) =>
      m(n === 1 ? "1 item" : `${n} items`),
    nameColumn: m("Name"),
    kindColumn: m("Type"),
    updatedColumn: m("Updated"),
    viewGrid: m("Grid view"),
    viewList: m("List view"),
    modeCv: m("CV"),
    modeLetter: m("Letter"),
    modeSwitch: m("Switch between CV and letter"),
    more: m("More"),
    uploadFile: m("Upload a file"),
    uploadCv: m("Upload a CV"),
    uploadLetter: m("Upload a cover letter"),
    downloadFile: m("Download"),
    replaceFile: m("Replace"),
    deleteFile: m("Delete"),
    signInToKeepFile: m("Sign in to keep the file."),
    filterAll: m("All"),
    noRowsForFilter: m("Nothing of this type yet."),
    showAllPapers: m("Show all"),
    askCoachList: m("Ask the Coach what to send"),
    askCoachListPrompt: m("What should I send tonight from this list?"),
    duplicate: m("Duplicate"),
    galleryTitle: m("Where is this CV going?"),
    letterChooserTitle: m("Who is this letter for?"),
    buildCv: m("Build a CV"),
    newLetter: m("Cover letter"),
    newProof: m("Proof"),
    backToList: m("Back"),
    backToSituations: m("Choose again"),
    rowActions: m("Actions for this paper"),
    includesPhoto: m("Includes a photo"),
    noPhoto: m("No photo"),
    cv: {
    emptyTitle: m("Build your first CV"),
    emptyWithProfile: m("Start from your profile, then tailor it to the job."),
    emptyWithoutProfile: m("Fill in your profile first and most of it writes itself. Or start blank."),
    buildFromProfile: m("Build from my profile"),
    startBlank: m("Start blank"),
    fillProfileFirst: m("Fill in your profile first"),
    emptyCanvas: m("The printed page appears here after you build."),
    editPane: m("Edit"),
    previewPane: m("Preview"),
    paneSwitch: m("Switch between edit and preview"),
    outlineLabel: m("Sections on this CV"),
    outlineHeader: m("Header"),
    sectionEmpty: m("Empty"),
    sectionFilled: m("Filled"),

    yourCvs: m("Your CVs"),
    documentCount: (n: number) =>
      m(n === 1 ? "1 CV" : `${n} CVs`),
    backToLibrary: m("Back"),
    duplicate: m("Duplicate this CV"),
    deleteCv: m("Delete this CV"),
    blankCv: m("Blank CV"),
    copySuffix: (label: string) => m(`${label} (copy)`),
    untitled: (n: number) => m(`CV ${n}`),
    forRole: (role: string) => m(`CV, ${role}`),
    completeness: m("How complete this CV is"),
    readyPercent: (n: number) => m(`${n}% ready`),

    appearance: m("Appearance"),
    style: m("Style"),
    styleHarvard: m("Harvard style"),
    styleMarketing: m("Marketing"),
    styleTech: m("Tech"),
    styleHarvardHint: m("Formal, one column"),
    styleMarketingHint: m("Clear story, room to breathe"),
    styleTechHint: m("Dense, one page"),
    // Named for the situation each one fits, not for its style. "Cổ điển" and
    // "Hiện đại" describe how a template looks to somebody who already knows
    // what a CV should look like; this audience is choosing their first one and
    // needs to be told which to use for a Vietnamese employer and which for an
    // application abroad. The identifiers in the model are unchanged.
    // A photo is a real decision here, not decoration: Vietnamese employers
    // expect one and many international and tech employers screen it out.
    photo: m("Photo"),
    photoHint: m("The Vietnamese standard template has a place for one."),
    photoAdd: m("Add a photo"),
    photoReplace: m("Replace it"),
    photoRemove: m("Remove the photo"),
    photoAlt: m("The photo on this CV"),
    photoFailed: m("That photo didn't upload. Try again."),
    template: m("Template"),
    templateClassic: m("Vietnamese employer"),
    templateInternship: m("Internship / first role"),
    templateAcademic: m("Academic / scholarship"),
    templateService: m("Part-time / service work"),
    templateCompact: m("Fits one page"),
    templateModern: m("Abroad / ATS"),
    templateTechnical: m("Technical"),
    templateDesign: m("Design / portfolio"),
    templateDesignHint: m("For human eyes. Job portals may not parse it."),
    accent: m("Accent colour"),
    cvLanguage: m("CV language"),
    accentInk: m("Ink"),
    accentBlue: m("Blue"),
    accentGreen: m("Green"),
    accentPlum: m("Plum"),
    density: m("Spacing"),
    densityHint: m("to fit one page"),
    densityAiry: m("Roomy"),
    densityNormal: m("Normal"),
    densityTight: m("Tight"),
    fitOnePage: m("Fit to one page"),
    sectionsMenu: m("Sections"),

    exportLabel: m("Export"),
    exportDownload: m("Download"),
    exportMarkdown: m("Markdown"),
    exportText: m("Plain text"),
    exportJson: m("Raw data"),
    exportCopy: m("Copy to paste into a form"),
    exportPdf: m("Export PDF"),
    exportPdfHint: m("Opens your print dialog. Choose “Save as PDF”."),
    downloaded: (file: string) => m(`Downloaded ${file}`),
    copied: m("CV copied"),
    copyFailedTitle: m("Couldn't copy"),
    copyFailedBody: m("Your browser blocked the clipboard. Download the .txt instead."),

    cvName: m("Name this CV"),
    cvNamePlaceholder: m("CV, Data Analyst"),
    headerName: m("Full name"),
    headerHeadline: m("One-line summary"),
    headerHeadlinePlaceholder: m("Third-year student · heading into data"),
    headerEmail: m("Email"),
    headerPhone: m("Phone"),
    headerLocation: m("Location"),
    headerLocationPlaceholder: m("Hanoi"),
    headerLink: m("Link"),
    headerLinkPlaceholder: m("linkedin.com/in/your-name"),
    askCoachHelp: m("Ask the Coach to sharpen this"),
    askCoachPrompt: (label: string) =>
      m(`Review my CV “${label}” and tighten up the weak parts`),

    addSection: m("Add a section"),
    sectionName: m("Section name"),
    hideSection: (heading: string) =>
      m(`Hide ${heading} from the printed CV`),
    showSection: (heading: string) =>
      m(`Show ${heading} again`),
    sectionHidden: m("Hidden from the printed CV"),
    sectionHide: m("Hide from the printed CV"),
    moveSectionUp: (heading: string) =>
      m(`Move ${heading} up`),
    moveSectionDown: (heading: string) =>
      m(`Move ${heading} down`),
    removeSection: (heading: string) =>
      m(`Delete ${heading}`),
    toggleSection: (heading: string) =>
      m(`Collapse or expand ${heading}`),

    addEntry: m("Add an entry"),
    entryNumber: (n: number) => m(`Entry ${n}`),
    entryTitle: m("Title"),
    entryTitlePlaceholder: m("Data intern"),
    entryOrg: m("Organisation"),
    entryOrgPlaceholder: m("ABC Company"),
    entryPeriod: m("Dates"),
    entryPeriodPlaceholder: m("Jun 2025 – Sep 2025"),
    entryDetail: m("What you achieved"),
    entryDetailPlaceholder: m("One per line, for example:\nBuilt a dashboard covering 12 campaigns, cutting weekly reporting from 4 hours to 30 minutes"),
    entryDetailHint: m("Each line becomes a bullet. Write results with numbers."),
    removeEntry: (title: string) => m(`Delete ${title}`),
    previewEmpty: m("Type on the page."),
    whereGoing: m("Where it's going"),

      },
    letter: {
    title: m("Letters"),
    lead: m("Write first, then sharpen."),
    newCoverLetter: m("New cover letter"),
    situationPosted: m("A posted job"),
    situationPostedHint: m("You have a posting to answer."),
    situationInternship: m("An internship"),
    situationInternshipHint: m("A program or term, not a job."),
    situationSpeculative: m("A company with no posting"),
    situationSpeculativeHint: m("You want in; they have not posted."),
    situationScholarship: m("A scholarship"),
    situationScholarshipHint: m("An award, not a role."),
    situationRole: m("Role"),
    situationOrg: m("Organisation"),
    situationProgram: m("Program or term"),
    situationAward: m("Scholarship"),
    toField: m("To"),
    toPlaceholder: m("hiring@company.com"),
    subjectField: m("Subject"),
    subjectPlaceholder: m("About an internship"),
    startLetter: m("Start the letter"),
    newFromOpening: m("Letter for a saved opening"),
    forOpening: (title: string) => m(`Letter · ${title}`),
    untitled: m("Untitled"),
    labelField: m("Document name"),
    labelPlaceholder: m("Letter for VNG"),
    targetRoleField: m("Role you're applying for"),
    targetRolePlaceholder: m("Data Analyst"),
    listLabel: m("Your letters"),
    listPane: m("List"),
    writePane: m("Write"),
    paneSwitch: m("Switch between list and editor"),
    paragraph: (n: number) => m(`Paragraph ${n}`),
    addParagraph: m("Add a paragraph"),
    moveUp: m("Move up"),
    moveDown: m("Move down"),
    removeParagraph: m("Delete this paragraph"),
    paragraphPlaceholder: m("Dear hiring team,"),
    emptyTitle: m("Write your first letter"),
    emptyBody: m("One letter per job. Start new, or from a saved opening."),
    emptyCanvas: m("The printed page appears here when you write."),
    emptyDocument: m("This one is empty. Write the first paragraph below."),
    askCoach: m("Ask the Coach to draft this"),
    askCoachHelp: m("Ask the Coach to sharpen this"),
    // Sent to the Coach as if the user typed it, so it reads like a request.
    //
    // One entry per kind rather than one generic sentence, because "write a
    // draft of this document" tells the Coach nothing about what it is holding.
    // A cover letter and a Proof want different shapes, and the
    // Proof's three parts are the difference between a story and a summary.
    // These are read in the *document's* language, not the app's, so an English
    // letter is asked for in English.
    askCoachLetter: m("Write me a first draft of this cover letter."),
    askCoachLetterFor: (role: string) =>
      m(`Write me a first draft of a cover letter for the ${role} role.`),
    askCoachProof: m("Draft this Proof: what it was, what I did, what came of it."),
    count: (n: number) => m(n === 1 ? "1 letter" : `${n} letters`),
      },
    proof: {
      emptyTitle: m("Log what you're making."),
      emptyBody: m("A class project, a shift, a failed experiment. Add what you have."),
      chipClass: m("A class project"),
      chipShift: m("A part-time shift"),
      chipFailed: m("Something that didn't work"),
      chipNone: m("I don't have one yet"),
      noteLabel: m("New note"),
      notePlaceholder: m("What happened? Paste links, numbers, photos."),
      noteEmpty: m("Write a note first."),
      addNote: m("Add a note"),
      addPhoto: m("Add a photo"),
      addFile: m("Add a file"),
      addLink: m("Add a link"),
      linkLabel: m("What to call this link"),
      linkUrl: m("Link"),
      photoCaption: m("What this photo is"),
      fileCaption: m("What this file is"),
      unpublish: m("Unpublish"),
      unpublished: m("The page is down. The space is still here."),
      roleField: m("Your role"),
      datesField: m("Dates"),
      linkField: m("Link"),
      prepare: m("Arrange"),
      arrange: m("Arrange"),
      whyField: m("Why this work"),
      whyPlaceholder: m("One short paragraph in your words."),
      includeProof: m("Include on the page"),
      arrangeLead: m("This is a draft of the public page. Leave and it stays."),
      publish: m("Publish"),
      copyLink: m("Copy link"),
      addToCv: m("Add to a CV"),
      untitled: m("Untitled Proof"),
      askCoachHelp: m("Ask the Coach to shape this"),
      suggestFromProfile: m("From your profile, this could count."),
      signInToPublish: m("Sign in to publish this Proof."),
      publishFailed: m("That did not publish. Try again."),
      linkCopied: m("Link copied"),
      copyFailed: m("Could not copy the link."),
      handleField: m("Your public link"),
      handleHint: m("Shown on your personal page."),
      handleSaved: m("Link saved"),
      handleInvalid: m("Use letters, numbers, and hyphens."),
      moreFromPerson: m("More from this person"),
      published: m("Published"),
      fileLabel: m("File"),
      emptySite: m("This person has not published work yet."),
      emptySiteAction: m("Go to OpenPath"),
    },
  },

  /* ── My Search ──────────────────────────────────────────────────────── */
  search: {
    title: m("Search"),
    askLabel: m("Search your opportunities"),
    lead: m("Ask about a role, company, city, requirement, saved or example opening."),
    addOpening: m("Add an opening"),
    pasteAction: m("Paste a posting"),
    pasteLabel: m("Paste a posting or a link"),
    pastePlaceholder: m("Paste the whole posting. I'll pull the requirements out."),
    pasteTooShort: m("Paste a bit more; that isn't enough to read."),
    searchPlaceholder: m("Data jobs in Hanoi"),
    startersLabel: m("Start with a question"),
    starterRoleCity: m("Data jobs in Hanoi"),
    starterRole: m("Analyst intern"),
    starterCompany: m("Fintech company"),
    starterSaved: m("Saved openings"),
    filterGroup: m("Which openings"),
    filterAll: m("All"),
    filterSaved: m("Saved"),
    filterSeeded: m("Examples"),
    resultCount: (n: number) =>
      m(n === 1 ? "1 opening" : `${n} openings`),
    save: m("Save"),
    unsave: m("Unsave"),
    saved: m("Saved"),
    apply: m("Start applying"),
    seededNote: m("An example, so you can see how the match reads."),
    fitCount: (met: number, total: number) =>
      m(`Meets ${met} of ${total} requirements`),
    fitUnknown: m("This posting lists no requirement we can read"),
    metHeading: m("You have"),
    missingHeading: m("Still missing"),
    unprovableHeading: m("Not scoreable, so not counted"),
    emptyProfileTitle: m("Your profile is empty"),
    emptyProfileBody: m("Add a course or two, or one experience, and I can rank these."),
    emptyProfileAction: m("Fill in your profile"),
    noOpeningsTitle: m("No openings yet"),
    noOpeningsBody: m("The list is empty."),
    noOpeningsAction: m("Paste a posting"),
    noMatches: (query: string) =>
      m(`Nothing matches “${query}”.`),
    commandPlaceholder: m("Data intern in Hanoi, saved only"),
    refinementsLabel: m("Read as"),
    removeConstraint: m("Remove this filter"),
    fieldRole: m("Role"),
    fieldOrg: m("Company"),
    fieldCity: m("City"),
    fieldCityPlaceholder: m("Hanoi"),
    fieldAsk: m("Other keywords"),
    facetAnyCity: m("Any city"),
    facetAnyOrg: m("Any company"),
    facetAnyRole: m("Any role"),
    keywordPlaceholder: m("Data jobs in Hanoi"),
    excludeLabel: m("Exclude"),
    excludePlaceholder: m("fintech, intern"),
    scopeLabel: m("Search in"),
    scopeAnywhere: m("Anywhere"),
    scopeTitle: m("Title + description"),
    scopeOrg: m("Company"),
    scopeCity: m("City"),
    scopeRequirements: m("Requirements"),
    filterLocation: m("Location"),
    filterCompany: m("Company"),
    filterSource: m("Source"),
    filterRole: m("Role"),
    topMatches: m("Top matches"),
    allOpenings: m("All openings"),
    openTracker: m("Open tracker"),
    noFilterMatches: m("No openings match this filter."),
    colFit: m("Fit"),
    fitPercent: (n: number) => m(`${n}% match`),
    inTracker: m("In your tracker"),
    clearFilter: m("Clear this filter"),
    filtersWord: m("filters"),
    filtersLeadBefore: m("These"),
    filtersLeadAfter: (n: number) =>
      m(n === 1
          ? "follow your ask (1 opening)"
          : `follow your ask (${n} openings)`),
    criteriaWord: m("criteria"),
    criteriaLeadBefore: m("These"),
    criteriaLeadAfter: m("rank your matches"),
    editFilters: m("Edit filters"),
    editCriteria: m("Edit criteria"),
    resetSearch: m("Reset search"),
    runSearch: m("Run search"),
    filtersControl: (n: number) => m(`Filters (${n})`),
    criteriaControl: (n: number) => m(`Criteria (${n})`),
    matchesHeading: (n: number) => m(`Matches (${n})`),
    whyHeading: m("Why it fits"),
    whyNames: (skill: string) =>
      m(`This posting names ${skill}.`),
    whyYouMeet: m("It's on your profile."),
    whyYouMiss: m("Not on your profile yet."),
    whyHave: (skill: string) =>
      m(`Your profile has ${skill}.`),
    whyMiss: (skill: string) =>
      m(`Your profile still needs ${skill}.`),
    addCriterion: m("Add a criterion"),
    criterionPlaceholder: m("SQL or Python"),
    doneEditing: m("Done"),
    editAsk: m("Edit your ask"),
  },

  /* ── My Applications ────────────────────────────────────────────────── */
  applications: {
    title: m("Applications"),
    statusInterested: m("Interested"),
    statusApplied: m("Applied"),
    statusInterviewing: m("Interviewing"),
    statusOffer: m("Offer"),
    statusRejected: m("Rejected"),
    nextStep: m("Next step"),
    notesLabel: m("Notes"),
    notesPlaceholder: m("Who you spoke to, what they asked, what to prepare."),
    deadlineLabel: m("Deadline"),
    clearDeadline: m("Clear the deadline"),
    askCoach: m("Ask the Coach what's next"),
    askCoachPrompt: (title: string, org: string, status: string) =>
      m(`I'm applying for ${title}${org ? ` at ${org}` : ""}, currently ${status}. What should I do next?`),
    tailorCv: m("Tailor for this job"),
    tailorLetter: m("Tailor a letter for this"),
    tailoredHeading: m("Tailored for this job"),
    tailorNeedsCv: m("Build a CV first, then I can copy it for this job."),
    emptyTitle: m("No applications yet"),
    emptyBody: m("Save a posting in Search, then start from there."),
    emptyAction: m("Go to Search"),
    remove: m("Delete this application"),
    endedHeading: m("Ended"),
    endedCount: (n: number) => m(`${n} closed`),
    stationEmpty: m("Drop a card here."),
    addOpenings: m("Add openings from Search"),
    fitCount: (met: number, total: number) =>
      m(`Fit ${met}/${total}`),
    advanceStatus: m("Move to next stage"),
  },

  /* ── Plans and billing ──────────────────────────────────────────────── */
  billing: {
    title: m("Plan and billing"),
    lead: m("Your plan sets how many Coach turns you get a month. Everything else is unlimited."),
    currentPlan: m("Current plan"),
    tierFree: m("Free"),
    tierPro: m("Pro"),
    tierUltra: m("Ultra"),
    perMonth: (usd: number) => m(`$${usd}/month`),
    turnsPerMonth: (n: number) =>
      m(`${n} Coach turns a month`),
    used: (used: number, total: number) =>
      m(`${used} of ${total} turns used`),
    renewsOn: (date: string) => m(`Renews ${date}`),
    endsOn: (date: string) => m(`Ends ${date}`),
    upgrade: m("Upgrade"),
    downgrade: m("Downgrade"),
    cancelPlan: m("Cancel plan"),
    cancelling: m("Cancelling at the end of this period"),
    pastDue: m("A payment didn't go through"),
    unavailable: m("Payment isn't available right now. Your plan is unchanged."),
    signInTitle: m("Sign in to manage your plan"),
    signInBody: m("Plan and billing live on your account."),
    // What the Coach says when the allowance is gone. The other tools keep
    // working, and the sentence says so.
    outOfTurns: m("Out of Coach turns this month"),
    outOfTurnsBody: m("Your CV, letters and applications still work. Only the Coach waits for a new period or an upgrade."),
  },

  /* ── Help and support ───────────────────────────────────────────────── */
  // Named `support` because `help` is already the help *menu* further down;
  // this is the page it should have pointed at all along.
  support: {
    title: m("Help"),
    lead: m("Common questions, and how to tell us something is wrong."),
    q1: m("Does the Coach change my work?"),
    a1: m("Yes, when you ask. Every change shows a card with an undo button, and deletions ask first."),
    q2: m("Where is my data?"),
    a2: m("In your account on the server. Sign in anywhere and it's all there."),
    q3: m("What if the Coach gets something wrong?"),
    a3: m("Press undo and tell it again. It also isn't allowed to invent numbers or experience."),
    q4: m("What happens when Coach turns run out?"),
    a4: m("Nothing. Your CV, letters and applications keep working; only the Coach waits."),
    reportTitle: m("Report a problem"),
    reportPlaceholder: m("What were you doing when it went wrong?"),
    reportSend: m("Send"),
    reportThanks: m("Got it. Thank you."),
    reportAgain: m("Send another"),
    reportFailed: m("That didn't send. Try again shortly."),
    reportTooShort: m("Add a sentence about what you were doing so we can follow."),
    notFoundTitle: m("This page isn't here"),
    notFoundBody: m("That address doesn't open anything. Go to the Coach."),
    notFoundAction: m("Go to the Coach"),
    notFoundPublicBody: m("That address doesn't open anything. Go to the home page, or create an account."),
    notFoundPublicAction: m("Go to OpenPath"),
    errorTitle: m("This page couldn't load"),
    errorBody: m("Refresh the page, or go to the Coach."),
    errorAction: m("Go to the Coach"),
  },

  /* ── Waiting list ───────────────────────────────────────────────────── */
  waitlist: {
    emailLabel: m("Your email"),
    emailPlaceholder: m("you@example.com"),
    join: m("Join"),
    joining: m("Sending"),
    joined: m("You're on the list. We'll email when a place opens."),
  },

  /* ── Help ───────────────────────────────────────────────────────────── */
  help: {
    label: m("Help"),
    sendFeedback: m("Send feedback"),
    prototypeNote: m("OpenPath · prototype"),
  },

  /* ── Pitch: the bio, the introduction, the answer bank ──────────────── */
  pitch: {
    title: m("My pitch"),
    lead: m("A place to write, then sharpen, what you say about yourself."),
    bioTitle: m("Online bio"),
    bioLead: m("For LinkedIn or a profile. Paste what you have, then make it sound like you."),
    introTitle: m("Self-introduction"),
    introLead: m("When they ask you to introduce yourself. Write it, then read it aloud."),
    answersTitle: m("Interview answers"),
    answersLead: m("Questions you will get. Write an answer, then tighten it."),
    questionField: m("The question"),
    questionPlaceholder: m("What's your greatest weakness?"),
    answerField: m("Your answer"),
    answerPlaceholder: m("Write your answer, then sharpen it…"),
    addAnswer: m("Add a question"),
    removeAnswer: m("Delete this one"),
    bioPlaceholder: m("Paste the bio you use, or a few lines about you…"),
    introPlaceholder: m("Write it as if you are speaking to them…"),
    emptyAnswers: m("None yet."),
    askCoachHelp: m("Ask the Coach to sharpen this"),
    askCoachBioPrompt: m("Sharpen my online bio so it sounds like me and matches my profile."),
    askCoachIntroPrompt: m("Sharpen my self-introduction so it sounds natural, from my profile and goal."),
    askCoachAnswerPrompt: (question: string) =>
      m(`Sharpen my answer to “${question}” so it sounds more natural.`),
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
    signInTitle: m("Sign in"),
    signInLead: m("Sign in to pick up where you left off."),
    signUpTitle: m("Create an account"),
    signUpLead: m("Create an account and your work is saved."),
    email: m("Email"),
    password: m("Password"),
    confirmPassword: m("Confirm password"),
    // Said before they type, not after they get it wrong.
    passwordHint: m("At least 8 characters."),
    rememberMe: m("Remember me"),
    signIn: m("Sign in"),
    signingIn: m("Signing in"),
    signUp: m("Create account"),
    signingUp: m("Creating your account"),
    signOut: m("Sign out"),
    noAccountYet: m("No account yet?"),
    haveAccount: m("Already have an account?"),
    // No recovery exists, so this says what to do instead of offering a link
    // that goes nowhere.
    forgotNote: m("There's no password reset yet, so keep yours somewhere safe."),
  },

  // What the guards say when they stop something. Written as the Coach would
  // say it, not as a system: the user is talking to a person, and a refusal
  // that suddenly reads like a firewall log tells them the person was never
  // there. Each one says what it will not do and offers what it will.
  guardrails: {
    injectionRefused: m("That asks me to ignore my own instructions, so I won't."),
    outOfScope: m("I don't give legal, medical or financial advice. On your career, I can help."),
    sensitiveRemoved: m("I removed the ID number from your message. A job application doesn't need it."),
    overBudget: m("This conversation has got too long. Start a new one."),
    // Appended to a reply that claimed a change with nothing to back it up.
    // Blunt on purpose: the user is about to open a screen and find it
    // unchanged, and hearing it here is better than finding it there.
    noActionTaken: m("Correction: I didn't actually change anything. Ask me again and I'll do it."),
    // Said when a reply carries a number or a fact the profile does not.
    // Naming it rather than deleting it: the user is the only one who knows
    // whether it is true, and they are about to use it in an interview.
    notGrounded: m("Something above isn't in your profile. Check it before you use it."),
  },

  /* ── Errors and system messages ─────────────────────────────────────── */
  // Every one of these says what happened and what to do about it. The change
  // that mattered most: the failed-action toast used to print the raw Zod
  // validation message, which is a developer's sentence shown to a student.
  errors: {
    // The account failures. Each one names what to do, and the one for bad
    // credentials deliberately does not say which field was wrong: telling
    // somebody the email exists is most of the work of breaking into it.
    authEmailRequired: m("Enter your email."),
    authEmailShape: m("Enter an email address, for example name@gmail.com."),
    authEmailTaken: m("That email already has an account. Sign in instead."),
    authPasswordRequired: m("Enter a password."),
    authPasswordTooShort: m("Use between 8 and 72 characters."),
    authConfirmRequired: m("Enter your password again."),
    authPasswordMismatch: m("Those passwords don't match."),
    authBadCredentials: m("That email and password don't match."),
    authRateLimited: m("Too many tries. Wait a minute and try again."),
    authStoreDown: m("That didn't go through. Try again shortly."),
    authOffline: m("No connection. Check your network and try again."),

    actionFailedTitle: m("That change didn't go through"),
    actionFailedBody: m("Nothing was lost. Try again."),
    storageFailedTitle: m("Your changes aren't being saved"),
    storageFailedBody: m("This will be gone when you reload. Try leaving private browsing."),
    waitlistEmailEmpty: m("Enter your email to join."),
    waitlistEmailShape: m("Enter an email address, for example name@gmail.com."),
    waitlistEmailTooLong: m("That email is too long."),
    waitlistBadRequest: m("That didn't send. Reload and try again."),
    waitlistRateLimited: m("Too many tries. Wait a minute."),
    waitlistStoreDown: m("Couldn't save that. Try again shortly."),
    waitlistOffline: m("No connection. Check your network and try again."),
  },
} as const;

