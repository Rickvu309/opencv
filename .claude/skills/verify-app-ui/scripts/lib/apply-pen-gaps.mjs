import { contrast, TOLERANCE } from "./pen-layout-compare.mjs"

const SERVER_DATES = "server time, checked by apply-design-parity.test.tsx"
export const NOT_SHOWN = {
  "w9-6-drag-to-stage": dates([
    "Oct 25",
    "Oct 22",
    "Oct 14",
    "Oct 21",
    "Oct 12",
    "Oct 2",
  ]),
  "w9-3-board": dates([
    "Oct 25",
    "Oct 22",
    "Oct 14",
    "Oct 21",
    "Oct 12",
    "Oct 2",
  ]),
  "w9-4-list": {
    ...dates(["Oct 25", "Oct 22", "Oct 14", "Oct 21", "Oct 12", "Oct 2"]),
    "Saved today": "the frame's JM has no deadline here but one in W9.7",
    "Applied Oct 14": SERVER_DATES,
    "Applied Oct 21": SERVER_DATES,
    "Round 2 on Nov 3": "JobView has no interview round",
  },
  "w9-7-calendar-month": {
    "Content intern": "the Oct 9 closed date is not stored",
    "Business analyst": "applied dates and inbox follow-ups are not stored",
    "Product analyst": "the frame's Oct 19 interview contradicts W9.8",
    "Marketing intern": "the Oct 21 applied date is not stored",
    "10:00 Associate PM": "the chip truncates the full title with an ellipsis",
  },
  "w9-8-calendar-week": {
    "Product analyst": "the block shows the full title",
    "Round 2 interview": "JobView has no interview round",
    "UX research due": "the deadline chip shows the full title",
  },
  "w10-4-job-detail": detailGaps(),
  "w10-5-link-from-paper": {
    ...detailGaps(),
    "Draft, edited Oct 21": SERVER_DATES,
    "Edited Oct 18": SERVER_DATES,
  },
  "w10-6-closed-job": {
    ...dates(["Sep 20", "Oct 6", "Oct 9"]),
    Subscribe: "the product has no activity subscription",
    "Added from TopCV": "the api writes You added this job from topcv.vn",
    "Round 2 interview": "JobView has no interview round",
    "Round 2 on Oct 6": "JobView has no interview round",
  },
}
const COMPANY_LOGOS_SHOWN_AS_INITIALS_TILES = 6
const FOLLOW_UP_REPLY_ICON_AND_NOT_SHOWN_DATE_CHIP = 2
const HEADER_LINK_PANEL_AND_PAPERCLIP_BUTTONS_WITHOUT_BEHAVIOR = 1
export const MARKS_NOT_DRAWN = {
  "w9-4-list": COMPANY_LOGOS_SHOWN_AS_INITIALS_TILES,
  "w9-7-calendar-month": FOLLOW_UP_REPLY_ICON_AND_NOT_SHOWN_DATE_CHIP,
  "w10-4-job-detail": HEADER_LINK_PANEL_AND_PAPERCLIP_BUTTONS_WITHOUT_BEHAVIOR,
  "w10-6-closed-job": 1,
}

const FAINT_PEN = {
  under: 3,
  reason:
    "no AA colour lies within 0.12 of a pen grey under 3:1 (#A0A0A2 lane counts, #C9C9CC out-of-month days), so the app colour only has to be the lightest AA colour",
  until: "2027-01-31",
  approvedBy: "pending operator (quanvu309)",
}
const today = new Date().toISOString().slice(0, 10)
export function faintPenColour(want, got) {
  if (today > FAINT_PEN.until) return false
  const need = want.fontSize >= 24 ? 3 : 4.5
  const shipped = contrast(got.color, got.background)
  return (
    contrast(want.color, want.background) < FAINT_PEN.under &&
    shipped >= need &&
    shipped <= need * TOLERANCE.contrastHeadroom
  )
}

function dates(list) {
  return Object.fromEntries(list.map((text) => [text, SERVER_DATES]))
}
function detailGaps() {
  return {
    ...dates(["Oct 10", "Oct 12", "Oct 20", "Oct 21"]),
    Subscribe: "the product has no activity subscription",
    "1 / 7": "the pager counts the board order, which puts this job 5th",
    "You added this job from ITviec":
      "the api writes You added this job from itviec.com",
    "You moved it to Interview": "the job is saved straight into Interview",
  }
}

const PENDING_OPERATOR = {
  until: "2027-01-31",
  approvedBy: "pending operator (quanvu309)",
}
export const LAYOUT_EXCEPTIONS = [
  {
    frameId: "U4613",
    text: "Junior Marketing",
    property: "y",
    reason:
      "the W9.7 frame stacks it under a follow-up chip the product does not store",
    ...PENDING_OPERATOR,
  },
  {
    frameId: "Wlp2X",
    text: "LN",
    property: "y",
    reason:
      "issue 954: W10.4 and W10.5 list the CV link line in Activity, W10.6 leaves it out",
    ...PENDING_OPERATOR,
  },
  {
    frameId: "Wlp2X",
    text: "Linh Nguyen",
    property: "y",
    reason:
      "issue 954: W10.4 and W10.5 list the CV link line in Activity, W10.6 leaves it out",
    ...PENDING_OPERATOR,
  },
  {
    frameId: "Wlp2X",
    text: "What I learned: the writing test went well. Next time, bring a sharper story with numbers.",
    property: "y",
    reason:
      "issue 954: W10.4 and W10.5 list the CV link line in Activity, W10.6 leaves it out",
    ...PENDING_OPERATOR,
  },
]
