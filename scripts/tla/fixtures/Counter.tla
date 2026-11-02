---- MODULE Counter ----
EXTENDS Naturals

CONSTANTS Max, Limit

VARIABLE count

Init == count = 0

Increment == count < Max /\ count' = count + 1

Reset == count = Max /\ count' = 0

Next == Increment \/ Reset

Spec == Init /\ [][Next]_count

Inv == count <= Limit
====
