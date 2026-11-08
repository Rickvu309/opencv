---- MODULE PriorityGrant ----
EXTENDS Naturals

CONSTANTS EnforceOpen, EnforceScope, EnforceBinding, PreserveNoop, Admitted, Other

VARIABLES revision, changes, priority, requested, phase, db, bound, opened, scope, grantScope, scopeOpen, target

Init ==
    /\ revision = 0
    /\ changes = 0
    /\ priority = 0
    /\ requested \in {0, 1}
    /\ phase = "idle"
    /\ db = 0
    /\ bound = 0
    /\ opened = FALSE
    /\ scope = 0
    /\ grantScope = 0
    /\ scopeOpen = FALSE
    /\ target = Admitted

Open ==
    /\ phase = "idle"
    /\ phase' = "open"
    /\ scope' = 1
    /\ scopeOpen' = TRUE
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, grantScope, target>>

Begin ==
    /\ ~opened
    /\ phase \in {"open", "held"}
    /\ db' = IF bound = 0 THEN 1 ELSE 2
    /\ opened' = TRUE
    /\ UNCHANGED <<revision, changes, priority, requested, phase, bound, scope, grantScope, scopeOpen, target>>

Take ==
    /\ phase = "open"
    /\ db \in {1, 2}
    /\ opened
    /\ scopeOpen
    /\ bound' = db
    /\ grantScope' = scope
    /\ phase' = "held"
    /\ UNCHANGED <<revision, changes, priority, requested, db, opened, scope, scopeOpen, target>>

Write ==
    /\ phase = "held"
    /\ db # 0
    /\ bound = db
    /\ (~EnforceOpen \/ opened)
    /\ (~EnforceScope \/ (scope = grantScope /\ scopeOpen))
    /\ (~EnforceBinding \/ target = Admitted)
    /\ revision' = revision + IF PreserveNoop THEN (IF priority # requested THEN 1 ELSE 0) ELSE 1
    /\ changes' = changes + IF priority # requested THEN 1 ELSE 0
    /\ priority' = requested
    /\ phase' = "spent"
    /\ UNCHANGED <<requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Commit ==
    /\ opened
    /\ opened' = FALSE
    /\ phase' = IF phase = "spent" THEN "done" ELSE phase
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, scope, grantScope, scopeOpen, target>>

Seal ==
    /\ phase \in {"open", "held", "spent", "refused", "done"}
    /\ scopeOpen
    /\ scopeOpen' = FALSE
    /\ phase' = IF phase = "held" THEN phase ELSE "sealed"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, target>>

Sibling ==
    /\ phase = "held"
    /\ ~scopeOpen
    /\ scope = 1
    /\ scope' = 2
    /\ scopeOpen' = TRUE
    /\ UNCHANGED <<revision, changes, priority, requested, phase, db, bound, opened, grantScope, target>>

Retarget ==
    /\ phase = "held"
    /\ target = Admitted
    /\ target' = Other
    /\ UNCHANGED <<revision, changes, priority, requested, phase, db, bound, opened, scope, grantScope, scopeOpen>>

Autocommit ==
    /\ phase = "open"
    /\ db = 0
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Late ==
    /\ phase = "held"
    /\ ~opened
    /\ bound # 0
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Cross ==
    /\ phase = "held"
    /\ db # 0
    /\ bound # 0
    /\ bound # db
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Stale ==
    /\ phase \in {"open", "held"}
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Forge ==
    /\ phase = "idle"
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Reuse ==
    /\ phase = "sealed" \/ (phase = "held" /\ (~scopeOpen \/ scope # grantScope))
    /\ phase' = "refused"
    /\ UNCHANGED <<revision, changes, priority, requested, db, bound, opened, scope, grantScope, scopeOpen, target>>

Rollback ==
    /\ phase = "spent"
    /\ revision' = 0
    /\ changes' = 0
    /\ priority' = 0
    /\ phase' = "sealed"
    /\ opened' = FALSE
    /\ scopeOpen' = FALSE
    /\ UNCHANGED <<requested, db, bound, scope, grantScope, target>>

Stop ==
    /\ phase \in {"refused", "sealed", "done"}
    /\ UNCHANGED <<revision, changes, priority, requested, phase, db, bound, opened, scope, grantScope, scopeOpen, target>>

Next ==
    \/ Open
    \/ Begin
    \/ Take
    \/ Write
    \/ Commit
    \/ Seal
    \/ Sibling
    \/ Retarget
    \/ Autocommit
    \/ Late
    \/ Cross
    \/ Stale
    \/ Forge
    \/ Reuse
    \/ Rollback
    \/ Stop

Spec == Init /\ [][Next]_<<revision, changes, priority, requested, phase, db, bound, opened, scope, grantScope, scopeOpen, target>>

Inv ==
    /\ revision \in Nat
    /\ revision = changes
    /\ phase \in {"idle", "open", "held", "spent", "done", "refused", "sealed"}
    /\ db \in 0..2
    /\ bound \in 0..2
    /\ scope \in 0..2
    /\ grantScope \in 0..2
    /\ target \in {Admitted, Other}
    /\ priority \in {0, 1}
    /\ opened \in BOOLEAN
    /\ scopeOpen \in BOOLEAN
    /\ (phase = "spent" => db = bound /\ bound # 0 /\ opened /\ scopeOpen /\ scope = grantScope /\ target = Admitted)
====
