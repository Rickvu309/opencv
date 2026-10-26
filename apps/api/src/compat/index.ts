// Temporary compat surface. #376 removed apply. #377 deletes threads and reverse, #378 paper, and #375 profile.
export {
  compatThreadByFocus,
  compatThreadDetail,
  isCompatCommand,
  listCompatPaper,
  listCompatThreads,
  runCompatCommand,
} from "./commands.js"
export { createCompatPaperRoutes, createCompatThreadRoutes } from "./http.js"
export { reverseCompatReceipt } from "./reverse.js"
