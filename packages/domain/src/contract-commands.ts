import { commandContract } from "./contract.js"
import { paperContract } from "./paper-doc/paper-contract.js"

export const commands = commandContract({
  ...paperContract,
})

type Commands = typeof commands
export type ContractCommandName = keyof Commands & string
