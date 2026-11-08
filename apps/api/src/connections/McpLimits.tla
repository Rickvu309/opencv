---- MODULE McpLimits ----
EXTENDS Naturals, Sequences, FiniteSets
CONSTANTS Processes, Scenario, SharedRolling, LockCap, ScopeCheck, ConnLimit, OwnerLimit, PendingCap
VARIABLES now, calls, windows, pending, worker, ownerLock, outsideRan
vars == <<now,calls,windows,pending,worker,ownerLock,outsideRan>>
Connections == {1,2}
Init ==
 /\ now = 0 /\ calls = <<>>
 /\ windows = [p \in Processes |-> [k \in {0,1,2} |-> [start |-> 0, count |-> 0]]]
 /\ pending = PendingCap - 1 /\ worker = [p \in Processes |-> "queued"]
 /\ ownerLock = 0 /\ outsideRan = FALSE
Recent(c) == Cardinality({i \in 1..Len(calls): now - calls[i].time < 2 /\ (c = 0 \/ calls[i].connection = c)})
LocalCount(p,k) == IF now - windows[p][k].start >= 2 THEN 0 ELSE windows[p][k].count
Allowed(p,c) == IF SharedRolling THEN Recent(c) < ConnLimit /\ Recent(0) < OwnerLimit ELSE LocalCount(p,c) < ConnLimit /\ LocalCount(p,0) < OwnerLimit
Call(p,c) ==
 /\ Scenario = "rate" /\ Len(calls) < 5 /\ Allowed(p,c)
 /\ calls' = Append(calls,[time |-> now,connection |-> c,process |-> p])
 /\ windows' = [windows EXCEPT ![p][c] = [start |-> IF @.count = 0 \/ now - @.start >= 2 THEN now ELSE @.start,count |-> LocalCount(p,c) + 1], ![p][0] = [start |-> IF @.count = 0 \/ now - @.start >= 2 THEN now ELSE @.start,count |-> LocalCount(p,0) + 1]]
 /\ UNCHANGED <<now,pending,worker,ownerLock,outsideRan>>
Tick ==
 /\ Scenario = "rate" /\ now < 2 /\ now' = now + 1
 /\ UNCHANGED <<calls,windows,pending,worker,ownerLock,outsideRan>>
CheckCap(p) ==
 /\ Scenario = "pending" /\ worker[p] = "queued"
 /\ (~LockCap \/ ownerLock = 0)
 /\ worker' = [worker EXCEPT ![p] = IF pending < PendingCap THEN "checked" ELSE "refused"]
 /\ ownerLock' = IF LockCap /\ pending < PendingCap THEN p ELSE ownerLock
 /\ UNCHANGED <<now,calls,windows,pending,outsideRan>>
Insert(p) ==
 /\ Scenario = "pending" /\ worker[p] = "checked"
 /\ pending' = pending + 1 /\ worker' = [worker EXCEPT ![p] = "inserted"] /\ ownerLock' = 0
 /\ UNCHANGED <<now,calls,windows,outsideRan>>
OutsideScope ==
 /\ Scenario = "scope" /\ worker[1] = "queued"
 /\ worker' = [worker EXCEPT ![1] = "finished"]
 /\ outsideRan' = ~ScopeCheck
 /\ UNCHANGED <<now,calls,windows,pending,ownerLock>>
Next ==
 \/ \E p \in Processes,c \in Connections: Call(p,c)
 \/ Tick
 \/ \E p \in Processes: CheckCap(p)
 \/ \E p \in Processes: Insert(p)
 \/ OutsideScope
Spec == Init /\ [][Next]_vars
Bound == Len(calls) <= 5 /\ pending <= PendingCap + 1
ScopeNeverRunsOutsideGrant == ~outsideRan
PendingCapNeverExceeded == pending <= PendingCap
ConnectionRollingMinuteLimit == \A c \in Connections: Recent(c) <= ConnLimit
OwnerRollingMinuteLimit == Recent(0) <= OwnerLimit
====
