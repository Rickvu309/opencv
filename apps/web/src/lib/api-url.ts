import { localDevUrls } from "@workspace/domain"

export const apiBaseUrl: string =
  import.meta.env.VITE_API_URL || localDevUrls(undefined).apiUrl
