export type CommandActorType = "user" | "coach"

/** Who is running a Command — the User, or the Coach acting in their workspace. */
export type CommandActor = {
  type: CommandActorType
  userId: string
}
