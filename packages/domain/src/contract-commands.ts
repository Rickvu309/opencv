import { commandContract } from "./contract.js"
import { inboxContract } from "./inbox-contract.js"
import { jobContract } from "./job-contract.js"

/** Every typed command, one table. A feature joins by spreading its contract here. */
export const commands = commandContract({
  ...jobContract,
  ...inboxContract,
})

export type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
