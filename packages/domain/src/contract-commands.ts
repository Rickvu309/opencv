import { commandContract } from "./contract.js"
import { inboxContract } from "./inbox-contract.js"
import { chatContract } from "./chat-contract.js"
import { jobContract } from "./job-contract.js"
import { paperContract } from "./paper-contract.js"

export const commands = commandContract({
  ...jobContract,
  ...inboxContract,
  ...paperContract,
  ...chatContract,
})

export type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
