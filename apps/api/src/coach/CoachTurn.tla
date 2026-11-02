---- MODULE CoachTurn ----
EXTENDS Naturals, FiniteSets

CONSTANTS Tabs, Tools,
          Settle, RecordOnAbort, Reconcile, Recovery,
          FinishInFinally, LeaseFilter, SkipToolPart, ReleaseNeedsSaved,
          SupersedeLock, LongTurns, CrashesOn

VARIABLES pc, kind, disc, tool, act, mem, status, hasText, fin,
          lease, chatLock, epoch, ep, reply, parts, supOf, target, plan

vars == <<pc, kind, disc, tool, act, mem, status, hasText, fin,
          lease, chatLock, epoch, ep, reply, parts, supOf, target, plan>>

None == "none"
Ids == Tabs \cup {"r0"}
Kinds == {"send", "regen"}
Statuses == {"final", "error", "aborted"}
Live == {"running", "finalizing", "reading", "inserted"}

Init ==
  /\ pc = [t \in Tabs |-> "idle"]
  /\ kind = [t \in Tabs |-> None]
  /\ disc = [t \in Tabs |-> FALSE]
  /\ tool = [t \in Tabs |-> [k \in Tools |-> "idle"]]
  /\ act = [t \in Tabs |-> {}]
  /\ mem = [t \in Tabs |-> {}]
  /\ status = [t \in Tabs |-> None]
  /\ hasText = [t \in Tabs |-> TRUE]
  /\ fin = [t \in Tabs |-> FALSE]
  /\ lease = None
  /\ chatLock = None
  /\ epoch = 0
  /\ ep = [t \in Tabs |-> 0]
  /\ reply = [i \in Ids |-> i = "r0"]
  /\ parts = [i \in Ids |-> {}]
  /\ supOf = [i \in Ids |-> None]
  /\ target = [t \in Tabs |-> None]
  /\ plan = [t \in Tabs |-> None]

epOf(i) == IF i = "r0" THEN 0 ELSE ep[i]

Visible == {i \in Ids : reply[i] /\ epOf(i) = epoch /\ ~\E j \in Ids : reply[j] /\ supOf[j] = i}

RECURSIVE ChainEnd(_, _)
ChainEnd(i, depth) ==
  IF depth = 0 THEN i
  ELSE IF \E j \in Ids : reply[j] /\ supOf[j] = i
       THEN ChainEnd(CHOOSE j \in Ids : reply[j] /\ supOf[j] = i, depth - 1)
       ELSE i

admissible(t) == \/ ~LeaseFilter \/ lease = None

startTurn(t, k) ==
  /\ pc[t] = "idle"
  /\ IF ~admissible(t)
        THEN /\ pc' = [pc EXCEPT ![t] = "rejected"]
             /\ UNCHANGED <<kind, epoch, ep, lease, target>>
        ELSE /\ k = "send" \/ Visible # {}
             /\ pc' = [pc EXCEPT ![t] = "running"]
             /\ kind' = [kind EXCEPT ![t] = k]
             /\ lease' = t
             /\ epoch' = IF k = "send" THEN epoch + 1 ELSE epoch
             /\ ep' = [ep EXCEPT ![t] = epoch']
             /\ target' = [target EXCEPT ![t] =
                  IF k = "regen" THEN CHOOSE i \in Visible : TRUE ELSE None]
  /\ UNCHANGED <<disc, tool, act, mem, status, hasText, fin, chatLock, reply, parts, supOf, plan>>

startAny == \E t \in Tabs, k \in Kinds : startTurn(t, k)

toolExecute(t, k) ==
  /\ pc[t] = "running" /\ kind[t] = "send" /\ ~disc[t]
  /\ tool[t][k] = "idle"
  /\ tool' = [tool EXCEPT ![t][k] = "started"]
  /\ UNCHANGED <<pc, kind, disc, act, mem, status, hasText, fin, lease, chatLock,
                 epoch, ep, reply, parts, supOf, target, plan>>

registryCommit(t, k) ==
  /\ tool[t][k] = "started" /\ pc[t] # "dead"
  /\ tool' = [tool EXCEPT ![t][k] = "committed"]
  /\ act' = [act EXCEPT ![t] = @ \cup {k}]
  /\ UNCHANGED <<pc, kind, disc, mem, status, hasText, fin, lease, chatLock,
                 epoch, ep, reply, parts, supOf, target, plan>>

recordPart(t, k) ==
  /\ tool[t][k] = "committed" /\ k \notin mem[t] /\ ~SkipToolPart
  /\ \/ pc[t] = "running" /\ ~disc[t]
     \/ RecordOnAbort /\ pc[t] \in {"running", "finalizing"}
  /\ mem' = [mem EXCEPT ![t] = @ \cup {k}]
  /\ UNCHANGED <<pc, kind, disc, tool, act, status, hasText, fin, lease, chatLock,
                 epoch, ep, reply, parts, supOf, target, plan>>

disconnect(t) ==
  /\ pc[t] = "running" /\ ~disc[t]
  /\ disc' = [disc EXCEPT ![t] = TRUE]
  /\ UNCHANGED <<pc, kind, tool, act, mem, status, hasText, fin, lease, chatLock,
                 epoch, ep, reply, parts, supOf, target, plan>>

stopTurn(t) == disconnect(t)

modelFinish(t, txt) ==
  /\ pc[t] = "running" /\ ~disc[t]
  /\ \A k \in Tools : tool[t][k] # "started"
  /\ act[t] \subseteq mem[t] \/ SkipToolPart
  /\ pc' = [pc EXCEPT ![t] = "finalizing"]
  /\ status' = [status EXCEPT ![t] = "final"]
  /\ hasText' = [hasText EXCEPT ![t] = txt]
  /\ UNCHANGED <<kind, disc, tool, act, mem, fin, lease, chatLock, epoch, ep,
                 reply, parts, supOf, target, plan>>

providerFail(t, txt) ==
  /\ pc[t] = "running" /\ ~disc[t]
  /\ pc' = [pc EXCEPT ![t] = "finalizing"]
  /\ status' = [status EXCEPT ![t] = "error"]
  /\ hasText' = [hasText EXCEPT ![t] = txt]
  /\ UNCHANGED <<kind, disc, tool, act, mem, fin, lease, chatLock, epoch, ep,
                 reply, parts, supOf, target, plan>>

abortEnd(t) ==
  /\ pc[t] = "running" /\ disc[t]
  /\ pc' = [pc EXCEPT ![t] = "finalizing"]
  /\ status' = [status EXCEPT ![t] = "aborted"]
  /\ UNCHANGED <<kind, disc, tool, act, mem, hasText, fin, lease, chatLock, epoch,
                 ep, reply, parts, supOf, target, plan>>

settled(t) ==
  \/ ~Settle
  \/ /\ \A k \in Tools : tool[t][k] # "started"
     /\ ~RecordOnAbort \/ act[t] \subseteq mem[t] \/ SkipToolPart

insertCoachMessageRead(t) ==
  /\ pc[t] = "finalizing" /\ settled(t)
  /\ \/ kind[t] = "send"
     \/ ~SupersedeLock
     \/ chatLock = None
  /\ chatLock' = IF kind[t] = "regen" /\ SupersedeLock THEN t ELSE chatLock
  /\ plan' = [plan EXCEPT ![t] =
       IF kind[t] = "regen" /\ ~hasText[t] THEN "skip"
       ELSE IF kind[t] = "regen" /\ epoch # ep[t] THEN "stale"
       ELSE IF kind[t] = "regen"
            THEN IF SupersedeLock THEN ChainEnd(target[t], 3) ELSE target[t]
            ELSE None]
  /\ pc' = [pc EXCEPT ![t] = "reading"]
  /\ UNCHANGED <<kind, disc, tool, act, mem, status, hasText, fin, lease, epoch, ep,
                 reply, parts, supOf, target>>

insertCoachMessage(t) ==
  /\ pc[t] = "reading"
  /\ pc' = [pc EXCEPT ![t] = "inserted"]
  /\ chatLock' = IF chatLock = t THEN None ELSE chatLock
  /\ IF plan[t] \in {"skip", "stale"}
        THEN UNCHANGED <<reply, parts, supOf>>
        ELSE /\ reply' = [reply EXCEPT ![t] = TRUE]
             /\ parts' = [parts EXCEPT ![t] =
                  IF Reconcile THEN mem[t] \cup act[t] ELSE mem[t]]
             /\ supOf' = [supOf EXCEPT ![t] = IF kind[t] = "regen" THEN plan[t] ELSE None]
  /\ UNCHANGED <<kind, disc, tool, act, mem, status, hasText, fin, lease, epoch, ep,
                 target, plan>>

insertFails(t) ==
  /\ pc[t] \in {"finalizing", "reading"} /\ settled(t)
  /\ pc' = [pc EXCEPT ![t] = IF FinishInFinally THEN "inserted" ELSE "failed"]
  /\ chatLock' = IF chatLock = t THEN None ELSE chatLock
  /\ UNCHANGED <<kind, disc, tool, act, mem, status, hasText, fin, lease, epoch, ep,
                 reply, parts, supOf, target, plan>>

finishCoachUsage(t) ==
  /\ pc[t] = "inserted"
  /\ IF ReleaseNeedsSaved /\ ~reply[t]
        THEN /\ pc' = [pc EXCEPT ![t] = "done"]
             /\ UNCHANGED <<fin, lease>>
        ELSE /\ pc' = [pc EXCEPT ![t] = "done"]
             /\ fin' = [fin EXCEPT ![t] = TRUE]
             /\ lease' = IF lease = t THEN None ELSE lease
  /\ UNCHANGED <<kind, disc, tool, act, mem, status, hasText, chatLock, epoch, ep,
                 reply, parts, supOf, target, plan>>

maybeTitle(t) ==
  /\ pc[t] = "done" /\ reply[t] /\ status[t] = "final"
  /\ UNCHANGED vars

crash(t) ==
  /\ CrashesOn /\ pc[t] \in Live
  /\ pc' = [pc EXCEPT ![t] = "dead"]
  /\ chatLock' = IF chatLock = t THEN None ELSE chatLock
  /\ UNCHANGED <<kind, disc, tool, act, mem, status, hasText, fin, lease, epoch, ep,
                 reply, parts, supOf, target, plan>>

leaseExpire ==
  /\ lease # None
  /\ \/ pc[lease] \in {"dead", "failed"}
     \/ LongTurns /\ pc[lease] \in Live
  /\ lease' = None
  /\ UNCHANGED <<pc, kind, disc, tool, act, mem, status, hasText, fin, chatLock,
                 epoch, ep, reply, parts, supOf, target, plan>>

recoverOrphan(t) ==
  /\ Recovery /\ Reconcile
  /\ pc[t] \in {"dead", "failed", "done"} /\ ~reply[t] /\ act[t] # {}
  /\ lease # t
  /\ reply' = [reply EXCEPT ![t] = TRUE]
  /\ parts' = [parts EXCEPT ![t] = act[t]]
  /\ UNCHANGED <<pc, kind, disc, tool, act, mem, status, hasText, fin, lease, chatLock,
                 epoch, ep, supOf, target, plan>>

atRest ==
  /\ \A t \in Tabs : pc[t] \in {"rejected", "done", "dead", "failed"}
  /\ UNCHANGED vars

Next ==
  \/ atRest
  \/ startAny
  \/ \E t \in Tabs :
       \/ \E k \in Tools : toolExecute(t, k) \/ registryCommit(t, k) \/ recordPart(t, k)
       \/ disconnect(t) \/ stopTurn(t) \/ abortEnd(t)
       \/ \E b \in BOOLEAN : modelFinish(t, b) \/ providerFail(t, b)
       \/ insertCoachMessageRead(t) \/ insertCoachMessage(t) \/ insertFails(t)
       \/ finishCoachUsage(t) \/ maybeTitle(t) \/ crash(t) \/ recoverOrphan(t)
  \/ leaseExpire

Progress ==
  \/ \E t \in Tabs :
       \/ \E k \in Tools : registryCommit(t, k) \/ recordPart(t, k)
       \/ abortEnd(t)
       \/ \E b \in BOOLEAN : modelFinish(t, b)
       \/ insertCoachMessageRead(t) \/ insertCoachMessage(t)
       \/ finishCoachUsage(t) \/ recoverOrphan(t)
  \/ leaseExpire

Spec == Init /\ [][Next]_vars /\ WF_vars(Progress)

TypeOK ==
  /\ pc \in [Tabs -> {"idle", "running", "finalizing", "reading", "inserted",
                      "failed", "done", "dead", "rejected"}]
  /\ lease \in Tabs \cup {None}
  /\ epoch \in 0..Cardinality(Tabs)

C1 == Cardinality({t \in Tabs : pc[t] \in Live}) <= 1

C2 == \A t \in Tabs : reply[t] => act[t] \subseteq parts[t]

OrphanRecovered == \A t \in Tabs :
  [](pc[t] \in {"dead", "failed", "done"} /\ act[t] # {}
     => <>(reply[t] /\ act[t] \subseteq parts[t]))

ActivityInUndo == \A t \in Tabs : \A k \in act[t] : tool[t][k] = "committed"

C4 == Cardinality(Visible) <= 1

C3Finishes == \A t \in Tabs :
  [](pc[t] \notin {"idle", "rejected"} => <>(fin[t] \/ pc[t] = "dead"))

C3Unlocks == \A t \in Tabs :
  [](pc[t] = "dead" => <>(lease # t))
====
