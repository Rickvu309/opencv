---- MODULE DelegateRevoke ----
EXTENDS Integers

CONSTANTS Check

VARIABLES connection, phase, read, revokedBeforeBody

vars == <<connection, phase, read, revokedBeforeBody>>

TypeOK ==
    /\ connection \in {"live", "revoked"}
    /\ phase \in {"auth", "body", "done"}
    /\ read \in {"none", "private", "refused"}
    /\ revokedBeforeBody \in BOOLEAN

Init ==
    /\ connection = "live"
    /\ phase = "auth"
    /\ read = "none"
    /\ revokedBeforeBody = FALSE

AuthReturns ==
    /\ phase = "auth"
    /\ phase' = "body"
    /\ UNCHANGED <<connection, read, revokedBeforeBody>>

Revoke ==
    /\ connection = "live"
    /\ connection' = "revoked"
    /\ revokedBeforeBody' = (phase # "done")
    /\ UNCHANGED <<phase, read>>

ToolBody ==
    /\ phase = "body"
    /\ phase' = "done"
    /\ IF connection = "revoked" /\ Check
         THEN read' = "refused"
         ELSE read' = "private"
    /\ UNCHANGED <<connection, revokedBeforeBody>>

Rest ==
    /\ phase = "done"
    /\ UNCHANGED vars

Next == AuthReturns \/ Revoke \/ ToolBody \/ Rest

Spec == Init /\ [][Next]_vars

RevokeFirstWins ==
    (phase = "done" /\ revokedBeforeBody) => read = "refused"

====
