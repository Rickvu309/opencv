import { OPEN_NEW_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-new-cv-selected",
  route: "/paper",
  steps: [
    ...OPEN_NEW_CV,
    { click: { role: "radio", name: "Academic" } },
    { waitFor: { text: "Education leads, for students" } },
  ],
}
