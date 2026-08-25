/**
 * Neutral sample author for client-side Paper / Pitch seed until persistence
 * lands. Not identity — Settings → Account reads the session.
 */
export type SampleAuthor = {
  name: string
  email: string
  avatarSrc: string
}

export const SAMPLE_AUTHOR_NAME = "Alex Tran"

export const SAMPLE_AUTHOR: SampleAuthor = {
  name: SAMPLE_AUTHOR_NAME,
  email: "you@openpath.app",
  avatarSrc: "",
}
