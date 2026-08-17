import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type CoachSession = {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
};

const CoachSessionContext = createContext<CoachSession | null>(null);

export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const value = useMemo(
    () => ({ threadId, setThreadId, dockOpen, setDockOpen }),
    [threadId, dockOpen],
  );
  return <CoachSessionContext.Provider value={value}>{children}</CoachSessionContext.Provider>;
}

export function useCoachSession() {
  const ctx = useContext(CoachSessionContext);
  if (!ctx) throw new Error("useCoachSession must be used inside the signed-in shell");
  return ctx;
}
