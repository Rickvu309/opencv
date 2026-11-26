import { commandContract } from "../contract.js"

export * from "./paper-contract-views.js"

export const paperContract = commandContract({})

export type PaperContract = typeof paperContract
