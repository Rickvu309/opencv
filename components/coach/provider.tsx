"use client";

import * as React from "react";

import { useCoachThread, type CoachThread } from "./thread";

/**
 * One Coach, for the whole app.
 *
 * The floating panel and `/coach` each used to call `useCoachThread`, which
 * meant two `useEveAgent` stores and therefore **two different durable
 * sessions**. Say something in the dock, open the full page, and the Coach had
 * never heard it. Both surfaces now read the same thread, so switching between
 * them is a change of view rather than a change of conversation.
 */
const CoachContext = React.createContext<CoachThread | null>(null);

/** Whether we are on the client never changes after the first render. */
const subscribeNever = () => () => {};

function CoachThreadHost({
  children,
  restore,
  selectedId,
  onSelect,
}: {
  children: React.ReactNode;
  restore: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // No seeded conversation, and no way to pass one. A transcript the user did
  // not have makes the Coach's first real reply read as a continuation of
  // somebody else's chat, and the empty state is a better first impression.
  const thread = useCoachThread({ restore, selectedId, onSelect });
  return <CoachContext.Provider value={thread}>{children}</CoachContext.Provider>;
}

export function CoachProvider({ children }: { children: React.ReactNode }) {
  // The server has no stored session, so it renders the seeded conversation.
  // Remounting the host once after hydration lets the restored session be read
  // at store creation, where `useEveAgent` needs it, without the server and the
  // client disagreeing about what the thread contains.
  //
  // `useSyncExternalStore` rather than a state-setting effect: it states the
  // server/client difference directly instead of rendering one answer and then
  // correcting it, which is the cascading render `react-hooks/set-state-in-effect`
  // objects to. Same reasoning as `lib/actions/store.tsx`.
  const hydrated = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  // `restore` as well as the key, because the key alone was not enough. The
  // hook reads the stored session in a `useState` initialiser, which runs on
  // the client's *first* render too — the one that has to match what the server
  // sent. So a returning user hydrated a header saying "Cuộc trò chuyện" over
  // a server-rendered "Đoạn chat mới", React threw a hydration mismatch and
  // regenerated the tree. Now the first render restores nothing, exactly like
  // the server's, and the remount is what brings the conversation back.
  // Which conversation is open. `null` means "whichever is newest", which is
  // what a returning visitor wants and what the host resolves at mount.
  //
  // It lives here rather than in the thread because switching conversations is
  // a remount: `useEveAgent` takes its events when it builds its store and
  // cannot be handed a different thread afterwards. The key below is what
  // performs the switch, so the id has to sit above the thing being keyed.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <CoachThreadHost
      key={hydrated ? (selectedId ?? "newest") : "seed"}
      restore={hydrated}
      selectedId={selectedId}
      onSelect={setSelectedId}
    >
      {children}
    </CoachThreadHost>
  );
}

export function useCoach(): CoachThread {
  const thread = React.useContext(CoachContext);
  if (!thread) throw new Error("useCoach must be used inside CoachProvider");
  return thread;
}
