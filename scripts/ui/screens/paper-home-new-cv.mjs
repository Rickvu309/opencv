import { OPEN_NEW_CV } from "../screen-steps.mjs"

export const screen = {
  id: "paper-home-new-cv",
  route: "/paper",
  steps: [...OPEN_NEW_CV, { click: { role: "radio", name: "Modern" } }],
}
