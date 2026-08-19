import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const COACH_ROLE_KEY = "openpath.coach-role";
const pickerRoles = ["cheap", "chat", "drafting"] as const;
export type CoachPickerRole = (typeof pickerRoles)[number];

function readCoachRole(): CoachPickerRole {
  if (typeof window === "undefined") return "chat";
  try {
    const raw = localStorage.getItem(COACH_ROLE_KEY);
    if (raw === "cheap" || raw === "chat" || raw === "drafting") return raw;
  } catch {
    /* private mode */
  }
  return "chat";
}

type CoachSession = {
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  pendingIntent: string | null;
  openDockWithIntent: (text: string) => void;
  takePendingIntent: () => string | null;
  coachRole: CoachPickerRole;
  setCoachRole: (role: CoachPickerRole) => void;
};

const CoachSessionContext = createContext<CoachSession | null>(null);

export function CoachSessionProvider({ children }: { children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [coachRole, setCoachRoleState] = useState<CoachPickerRole>("chat");

  useEffect(() => {
    setCoachRoleState(readCoachRole());
  }, []);

  const setCoachRole = (role: CoachPickerRole) => {
    setCoachRoleState(role);
    try {
      localStorage.setItem(COACH_ROLE_KEY, role);
    } catch {
      /* private mode */
    }
  };

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
      coachRole,
      setCoachRole,
    }),
    [threadId, dockOpen, pendingIntent, coachRole],
  );
  return <CoachSessionContext.Provider value={value}>{children}</CoachSessionContext.Provider>;
}

export function useCoachSession() {
  const ctx = useContext(CoachSessionContext);
  if (!ctx) throw new Error("useCoachSession must be used inside the signed-in shell");
  return ctx;
}
