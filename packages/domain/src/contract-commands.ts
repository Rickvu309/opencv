import { commandContract } from "./contract.js"
import { paperContract } from "./paper-contract.js"

export const commands = commandContract({
  ...paperContract,
})

export type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
