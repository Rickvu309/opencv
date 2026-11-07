---- MODULE PaperSave ----
EXTENDS Naturals, FiniteSets
CONSTANT Fault
VARIABLES phase, head, local, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit
vars == <<phase, head, local, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit>>
Init ==
 /\ phase = "Saved" /\ head = 0 /\ local = 0 /\ journal = 0 /\ typed = 0 /\ request = 0 /\ parent = 0
 /\ stored = {0} /\ receipts = {0} /\ commits = [h \in 0..2 |-> 0]
 /\ lost = FALSE /\ offlineUsed = FALSE /\ crashed = FALSE /\ reloaded = FALSE /\ oldDelivered = FALSE
 /\ audit = [kind |-> "initial", before |-> 0, after |-> 0]
Type ==
 /\ phase \in {"Saved", "Pending"} /\ local < 2
 /\ local' = local + 1 /\ typed' = local + 1
 /\ journal' = IF Fault = "journal" THEN journal ELSE local + 1
 /\ phase' = "Pending"
 /\ UNCHANGED <<head, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit>>
Send ==
 /\ phase = "Pending"
 /\ request' = local /\ parent' = head
 /\ phase' = IF Fault = "receipt" THEN "Saved" ELSE "In flight"
 /\ UNCHANGED <<head, local, journal, typed, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit>>
AcceptDurably ==
 /\ phase = "In flight"
 /\ request \in receipts \/ parent = head
 /\ head' = IF request \in receipts THEN head ELSE request
 /\ stored' = stored \cup {request} /\ receipts' = receipts \cup {request}
 /\ commits' = IF request \in receipts /\ Fault # "retry" THEN commits ELSE [commits EXCEPT ![request] = @ + 1]
 /\ phase' = "Committed; awaiting receipt"
 /\ audit' = [kind |-> "commit", before |-> head, after |-> IF request \in receipts THEN head ELSE request]
 /\ UNCHANGED <<local, journal, typed, request, parent, lost, offlineUsed, crashed, reloaded, oldDelivered>>
DeliverReceipt ==
 /\ phase = "Committed; awaiting receipt"
 /\ phase' = "Saved"
 /\ UNCHANGED <<head, local, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit>>
LoseReply ==
 /\ phase = "Committed; awaiting receipt" /\ ~lost
 /\ phase' = "Reply lost" /\ lost' = TRUE
 /\ UNCHANGED <<head, local, journal, typed, request, parent, stored, receipts, commits, offlineUsed, crashed, reloaded, oldDelivered, audit>>
Retry ==
 /\ phase \in {"Reply lost", "Server failed"}
 /\ phase' = "In flight"
 /\ UNCHANGED <<head, local, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit>>
ServerFails ==
 /\ phase = "In flight" /\ ~crashed
 /\ phase' = "Server failed" /\ crashed' = TRUE
 /\ head' = IF Fault = "crash" THEN request ELSE head
 /\ audit' = [kind |-> "crash before commit", before |-> head, after |-> IF Fault = "crash" THEN request ELSE head]
 /\ UNCHANGED <<local, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, reloaded, oldDelivered>>
GoOffline ==
 /\ phase = "Pending" /\ ~offlineUsed
 /\ phase' = "Offline" /\ offlineUsed' = TRUE
 /\ UNCHANGED <<head, local, journal, typed, request, parent, stored, receipts, commits, lost, crashed, reloaded, oldDelivered, audit>>
Reconnect ==
 /\ phase = "Offline" /\ phase' = "Pending"
 /\ UNCHANGED <<head, local, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, reloaded, oldDelivered, audit>>
Reload ==
 /\ phase \in {"Pending", "Offline", "Reply lost", "Server failed"} /\ ~reloaded
 /\ local' = IF journal > head THEN journal ELSE head
 /\ phase' = "Pending" /\ reloaded' = TRUE
 /\ UNCHANGED <<head, journal, typed, request, parent, stored, receipts, commits, lost, offlineUsed, crashed, oldDelivered, audit>>
DelayedOldSave ==
 /\ phase = "Saved" /\ head = 2 /\ ~oldDelivered
 /\ head' = IF Fault = "parent" THEN 1 ELSE head
 /\ stored' = stored \cup {1}
 /\ oldDelivered' = TRUE
 /\ audit' = [kind |-> "old hash with stale parent", before |-> head, after |-> IF Fault = "parent" THEN 1 ELSE head]
 /\ UNCHANGED <<phase, local, journal, typed, request, parent, receipts, commits, lost, offlineUsed, crashed, reloaded>>
Next == Type \/ Send \/ AcceptDurably \/ DeliverReceipt \/ LoseReply \/ Retry \/ ServerFails \/ GoOffline \/ Reconnect \/ Reload \/ DelayedOldSave
Spec == Init /\ [][Next]_vars
Bound == \A h \in 0..2 : commits[h] <= 2
SavedNamesStoredHash == phase = "Saved" => local \in stored /\ local \in receipts /\ local = head
LostReplyRetryStoresOnce == \A h \in 1..2 : commits[h] <= 1
OlderHashNeverReplacesNewerHead == audit.after >= audit.before
CrashBeforeCommitKeepsPreviousHead == audit.kind = "crash before commit" => audit.after = audit.before
WordsNeverLost == typed <= local \/ typed <= journal \/ typed <= head
====
