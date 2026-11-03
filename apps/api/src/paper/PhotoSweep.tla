---- MODULE PhotoSweep ----

CONSTANTS Split, Gap

VARIABLES referenced, exists, seen, pc

vars == <<referenced, exists, seen, pc>>

Init ==
    /\ referenced = FALSE
    /\ exists = TRUE
    /\ seen = TRUE
    /\ pc = "idle"

Attach ==
    /\ exists
    /\ IF Gap
       THEN /\ pc = "idle"
            /\ pc' = "checked"
            /\ UNCHANGED <<referenced, exists, seen>>
       ELSE /\ referenced' = TRUE
            /\ UNCHANGED <<exists, seen, pc>>

AttachWrite ==
    /\ Gap
    /\ pc = "checked"
    /\ referenced' = exists
    /\ pc' = "idle"
    /\ UNCHANGED <<exists, seen>>

Sweep ==
    /\ pc \in {"idle", "checked"}
    /\ IF Split
       THEN /\ pc' = "read"
            /\ seen' = referenced
            /\ UNCHANGED <<referenced, exists>>
       ELSE /\ exists' = IF referenced THEN exists ELSE FALSE
            /\ UNCHANGED <<referenced, seen, pc>>

SweepDrop ==
    /\ Split
    /\ pc = "read"
    /\ exists' = IF seen THEN exists ELSE FALSE
    /\ pc' = "idle"
    /\ UNCHANGED <<referenced, seen>>

Next ==
    \/ Attach
    \/ AttachWrite
    \/ Sweep
    \/ SweepDrop

Spec == Init /\ [][Next]_vars

PhotoLives == referenced => exists

====
