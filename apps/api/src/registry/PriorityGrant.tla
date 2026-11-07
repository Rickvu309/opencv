---- MODULE PriorityGrant ----
EXTENDS Naturals

CONSTANTS EnforceOpen

VARIABLES revision, phase, db, bound, opened

Init ==
    /\ revision = 0
    /\ phase = "idle"
    /\ db = 0
    /\ bound = 0
    /\ opened = FALSE

Open ==
    /\ phase = "idle"
    /\ phase' = "open"
    /\ UNCHANGED <<revision, db, bound, opened>>

Begin ==
    /\ ~opened
    /\ phase \in {"open", "held"}
    /\ db' = IF bound = 0 THEN 1 ELSE 2
    /\ opened' = TRUE
    /\ UNCHANGED <<revision, phase, bound>>

Take ==
    /\ phase = "open"
    /\ db \in {1, 2}
    /\ opened
    /\ bound' = db
    /\ phase' = "held"
    /\ UNCHANGED <<revision, db, opened>>

Autocommit ==
    /\ phase = "open"
    /\ db = 0
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound, opened>>

Write ==
    /\ phase = "held"
    /\ db # 0
    /\ bound = db
    /\ (~EnforceOpen \/ opened)
    /\ revision' = revision + 1
    /\ phase' = "spent"
    /\ UNCHANGED <<db, bound, opened>>

Commit ==
    /\ opened
    /\ opened' = FALSE
    /\ phase' = IF phase = "spent" THEN "done" ELSE phase
    /\ UNCHANGED <<revision, db, bound>>

Late ==
    /\ phase = "held"
    /\ ~opened
    /\ bound # 0
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound, opened>>

Cross ==
    /\ phase = "held"
    /\ db # 0
    /\ bound # 0
    /\ bound # db
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound, opened>>

Stale ==
    /\ phase \in {"open", "held"}
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound, opened>>

Forge ==
    /\ phase = "idle"
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound, opened>>

Seal ==
    /\ phase \in {"open", "held", "spent", "refused", "done"}
    /\ phase' = "sealed"
    /\ UNCHANGED <<revision, db, bound, opened>>

Reuse ==
    /\ phase = "sealed"
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, db, bound, opened>>

Rollback ==
    /\ phase = "spent"
    /\ revision > 0
    /\ revision' = revision - 1
    /\ phase' = "sealed"
    /\ opened' = FALSE
    /\ UNCHANGED <<db, bound>>

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

Spec == Init /\ [][Next]_<<revision, phase, db, bound, opened>>

Inv ==
    /\ revision \in Nat
    /\ phase \in {
        "idle", "open", "held", "spent", "done", "refused", "sealed"
       }
    /\ db \in 0..2
    /\ bound \in 0..2
    /\ opened \in BOOLEAN
    /\ (phase = "spent" => revision > 0 /\ db = bound /\ bound # 0 /\ opened)
====
