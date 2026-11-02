---- MODULE AuthOtp ----
EXTENDS Integers, FiniteSets

CONSTANTS Requests, Allowed, Tries, Locked

VARIABLES stored, pc, seen, left, evals, held

vars == <<stored, pc, seen, left, evals, held>>

Gone == -1

Init ==
    /\ stored = 0
    /\ pc = [r \in Requests |-> "idle"]
    /\ seen = [r \in Requests |-> 0]
    /\ left = [r \in Requests |-> Tries]
    /\ evals = 0
    /\ held = FALSE

Finish(r) ==
    /\ pc' = [pc EXCEPT ![r] = "idle"]
    /\ held' = IF Locked THEN FALSE ELSE held

Start(r) ==
    /\ pc[r] = "idle"
    /\ left[r] > 0
    /\ ~(Locked /\ held)
    /\ pc' = [pc EXCEPT ![r] = "read"]
    /\ left' = [left EXCEPT ![r] = left[r] - 1]
    /\ held' = IF Locked THEN TRUE ELSE held
    /\ UNCHANGED <<stored, seen, evals>>

Read(r) ==
    /\ pc[r] = "read"
    /\ IF stored = Gone
         THEN /\ Finish(r)
              /\ UNCHANGED <<stored, seen, left, evals>>
         ELSE IF stored >= Allowed
                THEN /\ stored' = Gone
                     /\ Finish(r)
                     /\ UNCHANGED <<seen, left, evals>>
                ELSE /\ seen' = [seen EXCEPT ![r] = stored]
                     /\ pc' = [pc EXCEPT ![r] = "compare"]
                     /\ UNCHANGED <<stored, left, evals, held>>

Compare(r) ==
    /\ pc[r] = "compare"
    /\ evals' = evals + 1
    /\ pc' = [pc EXCEPT ![r] = "write"]
    /\ UNCHANGED <<stored, seen, left, held>>

Write(r) ==
    /\ pc[r] = "write"
    /\ stored' = IF stored = Gone THEN stored ELSE seen[r] + 1
    /\ Finish(r)
    /\ UNCHANGED <<seen, left, evals>>

Settled ==
    /\ \A r \in Requests : pc[r] = "idle" /\ left[r] = 0
    /\ UNCHANGED vars

Next == (\E r \in Requests : Start(r) \/ Read(r) \/ Compare(r) \/ Write(r)) \/ Settled

Spec == Init /\ [][Next]_vars

TypeOK ==
    /\ stored \in Gone..Allowed
    /\ evals \in 0..(Tries * Cardinality(Requests))

A1 == evals <= Allowed
====
