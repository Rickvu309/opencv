---- MODULE PriorityGrant ----
EXTENDS Naturals

CONSTANTS Bump

VARIABLES revision, phase, db, bound

Init ==
    /\ revision = 0
    /\ phase = "idle"
    /\ db = 0
    /\ bound = 0

Open ==
    /\ phase = "idle"
    /\ phase' = "open"
    /\ UNCHANGED <<revision, db, bound>>

Begin ==
    /\ db = 0
    /\ phase \in {"open", "held"}
    /\ db' = IF bound = 0 THEN 1 ELSE 2
    /\ UNCHANGED <<revision, phase, bound>>

Take ==
    /\ phase = "open"
    /\ db \in {1, 2}
    /\ bound' = db
    /\ phase' = "held"
    /\ UNCHANGED <<revision, db>>

Autocommit ==
    /\ phase = "open"
    /\ db = 0
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound>>

Write ==
    /\ phase = "held"
    /\ db # 0
    /\ bound = db
    /\ revision' = revision + Bump
    /\ phase' = "spent"
    /\ UNCHANGED <<db, bound>>

Commit ==
    /\ db # 0
    /\ db' = 0
    /\ phase' = IF phase = "spent" THEN "done" ELSE phase
    /\ UNCHANGED <<revision, bound>>

Late ==
    /\ phase = "held"
    /\ db = 0
    /\ bound # 0
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound>>

Cross ==
    /\ phase = "held"
    /\ db # 0
    /\ bound # 0
    /\ bound # db
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound>>

Stale ==
    /\ phase \in {"open", "held"}
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound>>

Forge ==
    /\ phase = "idle"
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound>>

Seal ==
    /\ phase \in {"open", "held", "spent", "refused", "done"}
    /\ phase' = "sealed"
    /\ UNCHANGED <<revision, db, bound>>

Reuse ==
    /\ phase = "sealed"
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound>>

Rollback ==
    /\ phase = "spent"
    /\ revision > 0
    /\ revision' = revision - 1
    /\ phase' = "sealed"
    /\ db' = 0
    /\ UNCHANGED bound

Next ==
    \/ Open
    \/ Begin
    \/ Take
    \/ Autocommit
    \/ Write
    \/ Commit
    \/ Late
    \/ Cross
    \/ Stale
    \/ Forge
    \/ Seal
    \/ Reuse
    \/ Rollback

Spec == Init /\ [][Next]_<<revision, phase, db, bound>>

Inv ==
    /\ revision \in Nat
    /\ phase \in {
        "idle", "open", "held", "spent", "done", "refused", "sealed"
       }
    /\ db \in 0..2
    /\ bound \in 0..2
    /\ (phase = "spent" => revision > 0 /\ db = bound /\ bound # 0)
====
