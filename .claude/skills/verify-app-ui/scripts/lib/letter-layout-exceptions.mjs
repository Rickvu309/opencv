const SENDER_INDEX = 4
const PLAIN_BLOCK_LETTERHEAD = [
  ["Linh Nguyen", "fontSize", SENDER_INDEX],
  ["Linh Nguyen", "fontWeight", SENDER_INDEX],
  ["Linh Nguyen", "color", SENDER_INDEX],
  ["linh.nguyen@gmail.com | 090 123 4567 | Ho Chi Minh City", "y"],
  ["linh.nguyen@gmail.com | 090 123 4567 | Ho Chi Minh City", "fontSize"],
  ["linh.nguyen@gmail.com | 090 123 4567 | Ho Chi Minh City", "color"],
  ["October 26, 2026", "color"],
  ["Hiring Team", "color"],
  ["Lumière Cosmetics", "color"],
  ["Ho Chi Minh City", "color"],
  ["Dear Lumière hiring team,", "color"],
]
const BODY_GAP_TOLERANCE = 1.5
export const SIGN_OFF_GAP_DEVIATION = {
  text: "Linh Nguyen",
  index: 16,
  appGap: 29.5,
  reason:
    "the frame sets the signature 17px under the closing as one two-line sign-off; the letter is separate blocks that keep the body block gap",
  until: "2026-12-03",
  approvedBy: "#916 step 5 brief",
}
export const bodyGapMismatches = (
  layoutTexts,
  measured,
  today = new Date().toISOString().slice(0, 10)
) => {
  const first = layoutTexts.findIndex((t) => t.text.startsWith("I'm applying"))
  const last = layoutTexts.findIndex((t) =>
    t.text.startsWith("Thank you for reading")
  )
  const out = []
  for (let i = first + 1; i <= last; i += 1) {
    const pen = layoutTexts[i].y - layoutTexts[i - 1].y
    const app = measured[i].y - measured[i - 1].y
    if (Math.abs(pen - app) > BODY_GAP_TOLERANCE) {
      out.push({ text: layoutTexts[i].text.slice(0, 40), pen, app })
    }
  }
  const sign = SIGN_OFF_GAP_DEVIATION.index
  const pen = layoutTexts[sign].y - layoutTexts[sign - 1].y
  const app = measured[sign].y - measured[sign - 1].y
  const text = `${layoutTexts[sign - 1].text} to ${layoutTexts[sign].text}`
  if (today > SIGN_OFF_GAP_DEVIATION.until) {
    out.push({ text: `${text} (deviation expired)`, pen, app })
  } else if (Math.abs(pen - app) <= BODY_GAP_TOLERANCE) {
    out.push({ text: `${text} (deviation stale)`, pen, app })
  } else if (
    Math.abs(app - SIGN_OFF_GAP_DEVIATION.appGap) > BODY_GAP_TOLERANCE
  ) {
    out.push({ text: `${text} (deviation drifted)`, pen, app })
  }
  return out
}
export const PEN_LAYOUT_EXCEPTIONS = [
  {
    frameId: "sgAtL",
    text: "Edited just now",
    property: "x",
    reason: "no sliders glyph in the pill and no bell button (no feature)",
    until: "2027-06-30",
    approvedBy: "#830 header decision",
  },
  {
    frameId: "sgAtL",
    text: "Warm regards,",
    property: "y",
    reason:
      "the frame leaves a spacer line above the closing; a plain block letter has no spacer, so the closing keeps one body gap under the last paragraph",
    until: "2026-12-03",
    approvedBy: "#916 step 5 brief",
  },

  ...PLAIN_BLOCK_LETTERHEAD.map(([text, property, index]) => ({
    frameId: "sgAtL",
    text,
    property,
    ...(index === undefined ? {} : { index }),
    reason:
      "the letterhead is plain blocks, so sender, contact, date and recipient share the body style and spacing",
    until: "2026-12-03",
    approvedBy: "#916 step 5 brief",
  })),
]
