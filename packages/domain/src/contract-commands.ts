import { commandContract } from "./contract.js"
import { inboxContract } from "./inbox-contract.js"
import { jobContract } from "./job-contract.js"
import { paperContract } from "./paper-contract.js"

/** Every typed command, one table. A feature joins by spreading its contract here. */
export const commands = commandContract({
  ...jobContract,
  ...inboxContract,
  ...paperContract,
})

export type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
