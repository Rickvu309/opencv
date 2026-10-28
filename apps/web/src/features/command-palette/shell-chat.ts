type ShellChatOpen = {
  title: string
  chatId: string
}

type Opener = (next: ShellChatOpen) => void

let opener: Opener | null = null

export function registerShellChatOpener(next: Opener | null) {
  opener = next
}

export function requestShellChat(next: ShellChatOpen) {
  opener?.(next)
}
