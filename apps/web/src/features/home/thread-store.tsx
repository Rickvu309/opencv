import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { ThreadStoreContext } from "@/features/home/thread-store-context.ts"
import {
  COACH_THINKING_MS,
  STUB_COACH_REPLY,
  emptyThreadState,
  readPersistedThreads,
  titleFrom,
  writePersistedThreads,
  type HomeMessage,
} from "@/features/home/threads.ts"

function newMessageId() {
  return `m-${crypto.randomUUID()}`
}

export function ThreadStoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(
    () => readPersistedThreads() ?? emptyThreadState(),
    []
  )
  const [threads, setThreads] = useState(initial.threads)
  const [activeThreadId, setActiveThreadId] = useState(initial.activeThreadId)
  const [messages, setMessages] = useState(initial.messages)
  const [thinking, setThinking] = useState(false)
  const replyTimer = useRef<number | null>(null)

  const cancelThinking = useCallback(() => {
    if (replyTimer.current != null) {
      window.clearTimeout(replyTimer.current)
      replyTimer.current = null
    }
    setThinking(false)
  }, [])

  useEffect(() => {
    return () => {
      if (replyTimer.current != null) {
        window.clearTimeout(replyTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    writePersistedThreads({ threads, activeThreadId, messages })
  }, [threads, activeThreadId, messages])

  const newChat = useCallback(() => {
    cancelThinking()
    setActiveThreadId(null)
    setMessages([])
  }, [cancelThinking])

  const openThread = useCallback(
    (id: string) => {
      const thread = threads.find((item) => item.id === id)
      if (!thread) return
      cancelThinking()
      setActiveThreadId(id)
      setMessages(thread.messages)
    },
    [cancelThinking, threads]
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || thinking) return false

      const userMsg: HomeMessage = {
        id: newMessageId(),
        role: "user",
        text: trimmed,
      }
      const nextUserOnly = [...messages, userMsg]
      const startedAt = Date.now()
      const currentThreadId = activeThreadId

      setMessages(nextUserOnly)
      setThinking(true)

      replyTimer.current = window.setTimeout(() => {
        const reply: HomeMessage = {
          id: newMessageId(),
          role: "coach",
          text: STUB_COACH_REPLY,
          workedMs: Date.now() - startedAt,
        }
        const nextMessages = [...nextUserOnly, reply]

        if (currentThreadId) {
          setThreads((prev) =>
            prev.map((thread) =>
              thread.id === currentThreadId
                ? { ...thread, messages: nextMessages }
                : thread
            )
          )
        } else {
          const id = `c-${Date.now()}`
          setThreads((prev) => [
            { id, title: titleFrom(trimmed), messages: nextMessages },
            ...prev,
          ])
          setActiveThreadId(id)
        }

        setMessages(nextMessages)
        setThinking(false)
        replyTimer.current = null
      }, COACH_THINKING_MS)

      return true
    },
    [activeThreadId, messages, thinking]
  )

  const value = useMemo(
    () => ({
      threads,
      activeThreadId,
      messages,
      thinking,
      send,
      openThread,
      newChat,
    }),
    [threads, activeThreadId, messages, thinking, send, openThread, newChat]
  )

  return (
    <ThreadStoreContext.Provider value={value}>
      {children}
    </ThreadStoreContext.Provider>
  )
}
