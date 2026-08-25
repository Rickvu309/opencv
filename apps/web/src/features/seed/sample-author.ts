/**
 * Neutral sample author for Pitch seed and Paper fixture copy. Not identity —
 * Settings → Account reads the session. Paper persistence lives on the server.
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
