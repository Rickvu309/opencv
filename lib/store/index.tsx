// Public entry point for the store. `@/lib/store` resolves here, so every
// existing `import { useStore } from "@/lib/store"` keeps working unchanged
// after the RDS-981 split of the old single lib/store.tsx into
// lib/store/{state,actions,reducer,reducers/*,provider,helpers}.ts.

export { today, makeId } from "@/lib/store/helpers";
export type {
  OpportunitiesMode,
  OpportunitiesView,
  StoreState,
  OnboardingProfilePatch,
  TrackRecordConfirmPatch,
} from "@/lib/store/state";
export { StoreProvider, useStore, useCopilotSurface } from "@/lib/store/provider";
