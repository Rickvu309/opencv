---- MODULE PaperLease ----
EXTENDS Naturals, FiniteSets
CONSTANT Fault
VARIABLES holder, epoch, tokens, live, expired, head, parent, retained, audit
vars == <<holder, epoch, tokens, live, expired, head, parent, retained, audit>>
Writers == {"Tab A", "Tab B", "Coach"}
Authorized(w) == holder = w /\ tokens[w] = epoch /\ ~expired
Init == holder = "none" /\ epoch = 0 /\ tokens = [w \in Writers |-> 0] /\ live = {} /\ expired = FALSE /\ head = 0 /\ parent = [w \in Writers |-> 0] /\ retained = {}
 /\ audit = [authorized |-> TRUE, stale |-> FALSE, before |-> 0, after |-> 0, writer |-> "none"]
Grant(w) ==
 /\ epoch < 2 /\ (holder = "none" \/ expired \/ Fault = "exclusive") /\ w # holder
 /\ holder' = w /\ epoch' = epoch + 1
 /\ tokens' = [tokens EXCEPT ![w] = epoch + 1]
 /\ live' = IF Fault = "exclusive" THEN live \cup {w} ELSE {w}
 /\ expired' = FALSE /\ parent' = [parent EXCEPT ![w] = head]
 /\ UNCHANGED <<head, retained, audit>>
Expire ==
 /\ holder # "none" /\ ~expired
 /\ expired' = TRUE /\ live' = {}
 /\ UNCHANGED <<holder, epoch, tokens, head, parent, retained, audit>>
MaySave(w) == (Authorized(w) \/ Fault = "fence") /\ (parent[w] = head \/ Fault = "parent")
Save(w) ==
 /\ tokens[w] > 0 /\ head < 2
 /\ head' = IF MaySave(w) THEN head + 1 ELSE head
 /\ retained' = IF ~MaySave(w) THEN retained \cup {w} ELSE retained
 /\ audit' = [authorized |-> Authorized(w), stale |-> parent[w] # head, before |-> head, after |-> IF MaySave(w) THEN head + 1 ELSE head, writer |-> w]
 /\ UNCHANGED <<holder, epoch, tokens, live, expired, parent>>
Next == Expire \/ (\E w \in Writers : Grant(w) \/ Save(w))
Spec == Init /\ [][Next]_vars
Bound == head <= 2 /\ epoch <= 2
OnlyLeaseHolderMovesHead == audit.before # audit.after => audit.authorized
StaleParentKeepsHeadAndLosingBytes == audit.stale => audit.before = audit.after /\ audit.writer \in retained
NoTwoLiveLeases == Cardinality(live) <= 1
====
