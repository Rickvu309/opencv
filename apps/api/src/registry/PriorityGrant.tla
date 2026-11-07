---- MODULE PriorityGrant ----
EXTENDS Naturals

CONSTANTS Bump

VARIABLES revision, phase

Init == revision = 0 /\ phase = "idle"

Open ==
    /\ phase = "idle"
    /\ phase' = "open"
    /\ UNCHANGED revision

Write ==
    /\ phase = "open"
    /\ revision' = revision + Bump
    /\ phase' = "spent"

Stale ==
    /\ phase = "open"
    /\ phase' = "refused"
    /\ UNCHANGED revision

Forge ==
    /\ phase = "idle"
    /\ phase' = "refused"
    /\ UNCHANGED revision

Seal ==
    /\ phase \in {"open", "spent", "refused"}
    /\ phase' = "sealed"
    /\ UNCHANGED revision

Reuse ==
    /\ phase = "sealed"
    /\ phase' = "refused"
    /\ UNCHANGED revision

Rollback ==
    /\ phase = "spent"
    /\ revision > 0
    /\ revision' = revision - 1
    /\ phase' = "sealed"

Next == Open \/ Write \/ Stale \/ Forge \/ Seal \/ Reuse \/ Rollback

Spec == Init /\ [][Next]_<<revision, phase>>

Inv ==
    /\ revision \in Nat
    /\ phase \in {"idle", "open", "spent", "refused", "sealed"}
    /\ (phase = "spent" => revision > 0)
====
