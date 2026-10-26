// Temporary compat surface. #376 removed apply. #378 removed paper.
// #377 deletes threads and reverse, and #375 profile.
export {
  compatThreadByFocus,
  compatThreadDetail,
  isCompatCommand,
  listCompatThreads,
  runCompatCommand,
} from "./commands.js"
export { createCompatThreadRoutes } from "./http.js"
