import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type CoachSession = {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  pendingIntent: string | null;
  openDockWithIntent: (text: string) => void;
  takePendingIntent: () => string | null;
};

const CoachSessionContext = createContext<CoachSession | null>(null);

export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const value = useMemo(
    () => ({
      threadId,
      setThreadId,
      dockOpen,
      setDockOpen,
      pendingIntent,
      openDockWithIntent: (text: string) => {
        setPendingIntent(text);
        setDockOpen(true);
      },
      takePendingIntent: () => {
        const next = pendingIntent;
        setPendingIntent(null);
        return next;
      },
    }),
    [threadId, dockOpen, pendingIntent],
  );
  return <CoachSessionContext.Provider value={value}>{children}</CoachSessionContext.Provider>;
}

export function useCoachSession() {
  const ctx = useContext(CoachSessionContext);
  if (!ctx) throw new Error("useCoachSession must be used inside the signed-in shell");
  return ctx;
}
