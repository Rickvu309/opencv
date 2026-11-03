---- MODULE PhotoSweep ----

CONSTANTS Split

VARIABLES referenced, exists, seen, pc

vars == <<referenced, exists, seen, pc>>

Init ==
    /\ referenced = FALSE
    /\ exists = TRUE
    /\ seen = TRUE
    /\ pc = "idle"

Attach ==
    /\ exists
    /\ referenced' = TRUE
    /\ UNCHANGED <<exists, seen, pc>>

Sweep ==
    /\ pc = "idle"
    /\ IF Split
       THEN /\ pc' = "read"
            /\ seen' = referenced
            /\ UNCHANGED <<referenced, exists>>
       ELSE /\ exists' = IF referenced THEN TRUE ELSE FALSE
            /\ UNCHANGED <<referenced, seen, pc>>

SweepDrop ==
    /\ Split
    /\ pc = "read"
    /\ exists' = IF seen THEN exists ELSE FALSE
    /\ pc' = "idle"
    /\ UNCHANGED <<referenced, seen>>

Next ==
    \/ Attach
    \/ Sweep
    \/ SweepDrop

Spec == Init /\ [][Next]_vars

PhotoLives == referenced => exists

====
