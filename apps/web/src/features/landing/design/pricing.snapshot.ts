export const pricingSnapshot = {
  source: {
    file: "design/opencv.pen",
    branch: "chore/350-design-kit-cli-skills",
    frameId: "q720Ng",
    frameName: "Pricing (Linear layout)",
    width: 1440,
  },
  sections: [
    { id: "Jqxuh", name: "Nav", padTop: 0 },
    { id: "ZuXF5", name: "Header", padTop: 96 },
    { id: "bsQjH", name: "Plans", padTop: 64 },
    { id: "ynkIl", name: "Included", padTop: 112 },
    { id: "B2jxt", name: "Compare", padTop: 112 },
    { id: "f6nLk2", name: "FAQ", padTop: 112 },
    { id: "wp0PS", name: "Prefooter", padTop: 224 },
    { id: "PtgQw", name: "Footer Wrap", padTop: 160 },
  ],
  metrics: {
    columnPx: 880,
    titlePx: 56,
    titleTrackingPx: -1.6,
    titleLineHeight: 1,
    headerGapPx: 20,
    subheadPx: 22,
    subheadTrackingPx: -0.25,
    padHeaderPx: 96,
    padPlansPx: 64,
    padBlockPx: 112,
    padPrefooterPx: 224,
    padFooterPx: 160,
    prefooterGapPx: 40,
    plansGapPx: 24,
    cardPadPx: 32,
    cardRadiusPx: 24,
    buttonPx: 44,
    pricePx: 56,
    priceTrackingPx: -1.8,
    sectionTitlePx: 24,
    sectionTrackingPx: -0.4,
    faqPadPx: 22,
    compareHeadPx: 44,
    compareRowPx: 48,
    compareValuePx: 180,
    compareGroupPadTopPx: 20,
    compareGroupPadBottomPx: 10,
    includedGapPx: 28,
    includedRowGapPx: 24,
    tilePx: 36,
    tileRadiusPx: 10,
    includedIconPx: 18,
  },
  header: {
    title: "Pricing",
    subhead: "Start free. Upgrade when you need more Coach.",
  },
  plans: {
    free: {
      name: "Free",
      audience: "Try opencv with no card.",
      price: "$0",
      period: "per month",
      cta: "Start free",
      note: "No credit card required",
      tone: "neutral",
      surface: "paper",
      features: [
        "Limited Coach chats",
        "Basic Coach model",
        "CVs and cover letters in Paper",
        "Board, list and calendar in Apply",
        "Integrations",
      ],
    },
    pro: {
      name: "Pro",
      kicker: "For active search",
      kickerOnNameRow: true,
      audience: "For when you apply every week.",
      price: "$9",
      period: "per month",
      cta: "Get Pro",
      note: "Cancel anytime",
      tone: "white",
      surface: "mesh",
      lead: "Everything in Free, plus",
      features: [
        "Unlimited Coach chats",
        "Stronger Coach model",
        "Priority support",
        "Early access to Proof and Pitch",
      ],
    },
  },
  included: {
    title: "Every plan includes",
    items: [
      {
        icon: "file-text",
        title: "Paper",
        body: "Write and tailor CVs and letters.",
      },
      {
        icon: "kanban",
        title: "Apply",
        body: "Track every job from Saved to Offer.",
      },
      {
        icon: "calendar",
        title: "Calendar",
        body: "Interviews and deadlines in one view.",
      },
      {
        icon: "plug",
        title: "Integrations",
        body: "Gmail, Calendar, Drive and more.",
      },
    ],
  },
  compare: {
    title: "Compare plans",
    columns: ["Free", "Pro"],
    blocks: [
      {
        label: "Coach",
        rows: [
          {
            feature: "Chats",
            free: { kind: "text", value: "Limited" },
            pro: { kind: "text", value: "Unlimited" },
          },
          {
            feature: "Model",
            free: { kind: "text", value: "Basic" },
            pro: { kind: "text", value: "Stronger" },
          },
          {
            feature: "Instructions and memory",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
        ],
      },
      {
        label: "Paper",
        rows: [
          {
            feature: "CVs and cover letters",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
          {
            feature: "Templates",
            free: { kind: "text", value: "Basic" },
            pro: { kind: "text", value: "All" },
          },
          {
            feature: "Export to PDF and DOCX",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
        ],
      },
      {
        label: "Apply",
        rows: [
          {
            feature: "Board, list and calendar",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
          {
            feature: "Job details and interview prep",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
          {
            feature: "Integrations",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
        ],
      },
      {
        label: "Support",
        rows: [
          {
            feature: "Help centre",
            free: { kind: "check" },
            pro: { kind: "check" },
          },
          {
            feature: "Priority support",
            free: { kind: "dash" },
            pro: { kind: "check" },
          },
        ],
      },
      {
        label: "Coming soon",
        rows: [
          {
            feature: "Proof",
            free: { kind: "dash" },
            pro: { kind: "text", value: "Early access" },
          },
          {
            feature: "Pitch",
            free: { kind: "dash" },
            pro: { kind: "text", value: "Early access" },
          },
        ],
      },
    ],
  },
  faq: {
    title: "Questions",
    items: [
      {
        q: "What happens when I hit the Free limit?",
        a: "Coach pauses until your limit resets. Paper and Apply keep working.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Pro stays on until the end of your billing month.",
      },
      {
        q: "Is my data used to train models?",
        a: "No. Your CVs, jobs and chats are never used to train models.",
      },
      {
        q: "How do I pay?",
        a: "By card, billed monthly in USD. Local taxes may apply.",
      },
      {
        q: "What is coming to Pro?",
        a: "Proof and Pitch. Pro members get them first.",
      },
    ],
  },
} as const
