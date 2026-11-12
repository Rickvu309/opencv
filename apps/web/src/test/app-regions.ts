import { screen, waitFor, within } from "@testing-library/react"

export async function findAppMain() {
  const main = await waitFor(() => {
    const element = document.getElementById("app-main")
    if (!element) throw new Error("The app has not rendered its main area")
    return element
  })
  return within(main)
}

export function appNotifications() {
  return within(screen.getByLabelText(/^Notifications/))
}
