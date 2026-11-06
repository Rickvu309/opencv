import { connectionsContract } from "./connections-contract.js"
import { commandContract } from "./contract.js"
import { accountContract } from "./account-contract.js"
import { inboxContract } from "./inbox-contract.js"
import { chatContract } from "./chat-contract.js"
import { jobContract } from "./job-contract.js"
import { paperContract } from "./paper-contract.js"

export const commands = commandContract({
  ...connectionsContract,
  ...jobContract,
  ...inboxContract,
  ...paperContract,
  ...chatContract,
  ...accountContract,
})

export type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
