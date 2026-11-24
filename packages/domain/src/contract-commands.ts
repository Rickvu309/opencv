import { coachTaskContract } from "./coach-task-contract.js"
import { connectionsContract } from "./connections-contract.js"
import { commandContract } from "./contract.js"
import { controlContract } from "./control-contract.js"
import { accountContract } from "./account-contract.js"
import { inboxContract } from "./inbox-contract.js"
import { chatContract } from "./chat-contract.js"
import { jobContract } from "./job-contract.js"
import { paperContract } from "./paper-contract.js"

export const commands = commandContract({
  ...connectionsContract,
  ...coachTaskContract,
  ...jobContract,
  ...inboxContract,
  ...paperContract,
  ...chatContract,
  ...controlContract,
  ...accountContract,
})

export type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
