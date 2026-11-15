--------------------------- MODULE PaperNativeLocal ---------------------------
EXTENDS Naturals, FiniteSets

CONSTANTS ExactSaved, RefreshUnderLock, RetainWriteLock
VARIABLES phase, current, alive, ownLock, recoveryLock, orphan, seen, deleted,
          generation, journal, cleared, local, request, accepted, flight

vars == <<phase, current, alive, ownLock, recoveryLock, orphan, seen, deleted,
          generation, journal, cleared, local, request, accepted, flight>>

Init == /\ phase = "discover"
        /\ current = TRUE
        /\ alive = TRUE
        /\ ownLock = TRUE
        /\ recoveryLock = FALSE
        /\ orphan = 1
        /\ seen = 0
        /\ deleted = FALSE
        /\ generation = 0
        /\ journal = {}
        /\ cleared = {}
        /\ local = 0
        /\ request = 0
        /\ accepted = 0
        /\ flight = 0

Discover == /\ alive /\ current /\ phase = "discover"
            /\ seen' = orphan /\ phase' = "discovered"
            /\ UNCHANGED <<current, alive, ownLock, recoveryLock, orphan,
                 deleted, generation, journal, cleared, local, request, accepted, flight>>

OrphanWrites == /\ phase \in {"discover", "discovered"} /\ orphan = 1
                /\ orphan' = 2
                /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock, seen,
                     deleted, generation, journal, cleared, local, request, accepted, flight>>

LockAndReread == /\ alive /\ current /\ phase = "discovered"
                 /\ recoveryLock' = TRUE /\ phase' = "locked"
                 /\ seen' = (IF RefreshUnderLock THEN orphan ELSE seen)
                 /\ UNCHANGED <<current, alive, ownLock, orphan, deleted,
                      generation, journal, cleared, local, request, accepted, flight>>

Adopt == /\ alive /\ current /\ phase = "locked"
         /\ generation' = seen /\ journal' = {seen} /\ phase' = "ready"
         /\ UNCHANGED <<current, alive, ownLock, recoveryLock, orphan, seen,
              deleted, cleared, local, request, accepted, flight>>

Type == /\ alive /\ current /\ phase = "ready" /\ generation < 2
         /\ generation' = generation + 1 /\ journal' = journal \cup {generation + 1}
         /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock, orphan, seen,
              deleted, cleared, local, request, accepted, flight>>

LocalRequest == /\ alive /\ current /\ phase = "ready"
                /\ request = 0 /\ local < generation /\ request' = generation
                /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock,
                     orphan, seen, deleted, generation, journal, cleared, local, accepted, flight>>

DurabilityPointD == /\ request > 0
                    /\ local' = request /\ request' = 0
                    /\ ownLock' = (IF alive THEN ownLock ELSE FALSE)
                    /\ recoveryLock' = (IF alive THEN recoveryLock ELSE FALSE)
                    /\ UNCHANGED <<phase, current, alive, orphan, seen, deleted,
                         generation, journal, cleared, accepted, flight>>

LocalAbort == /\ request > 0 /\ request' = 0
              /\ ownLock' = (IF alive THEN ownLock ELSE FALSE)
              /\ recoveryLock' = (IF alive THEN recoveryLock ELSE FALSE)
              /\ UNCHANGED <<phase, current, alive, orphan, seen, deleted,
                   generation, journal, cleared, local, accepted, flight>>

DeleteAdoptedOrphan == /\ alive /\ current /\ recoveryLock
                       /\ phase = "ready" /\ ~deleted /\ local >= seen
                       /\ deleted' = TRUE
                       /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock,
                            orphan, seen, generation, journal, cleared, local, request, accepted, flight>>

Send == /\ alive /\ current /\ phase = "ready" /\ flight = 0 /\ generation > accepted
         /\ flight' = generation
         /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock, orphan, seen,
              deleted, generation, journal, cleared, local, request, accepted>>

Receipt == /\ flight > 0 /\ flight' = 0
            /\ accepted' = (IF alive /\ current /\ flight = generation THEN flight ELSE accepted)
            /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock, orphan, seen,
                 deleted, generation, journal, cleared, local, request>>

ClearCovered == LET covered == {entry \in journal : entry <= local /\ entry <= accepted}
                IN /\ alive /\ current /\ recoveryLock /\ covered # {}
                   /\ journal' = journal \ covered /\ cleared' = cleared \cup covered
                   /\ UNCHANGED <<phase, current, alive, ownLock, recoveryLock,
                        orphan, seen, deleted, generation, local, request, accepted, flight>>

IdentityChanges == /\ current /\ current' = FALSE
                   /\ UNCHANGED <<phase, alive, ownLock, recoveryLock, orphan, seen,
                        deleted, generation, journal, cleared, local, request, accepted, flight>>

Destroy == /\ alive /\ alive' = FALSE /\ phase' = "closed"
           /\ ownLock' = (RetainWriteLock /\ request > 0)
           /\ recoveryLock' = (recoveryLock /\ request > 0)
           /\ UNCHANGED <<current, orphan, seen, deleted, generation,
                journal, cleared, local, request, accepted, flight>>

Idle == UNCHANGED vars
Next == Discover \/ OrphanWrites \/ LockAndReread \/ Adopt \/ Type \/ LocalRequest
        \/ DurabilityPointD \/ LocalAbort \/ DeleteAdoptedOrphan \/ Send \/ Receipt
        \/ ClearCovered \/ IdentityChanges \/ Destroy \/ Idle

Saved == alive /\ current /\ phase = "ready" /\ accepted = generation
         /\ (IF ExactSaved THEN local = generation ELSE TRUE)
SavedHasExactD == Saved => local = generation /\ accepted = generation
AdoptedBeforeDeletion == deleted => local >= orphan
PendingWriteOwnsLock == request > 0 => ownLock
ClearedHasBothReceipts == \A entry \in cleared : entry <= local /\ entry <= accepted
TypeOK == /\ phase \in {"discover", "discovered", "locked", "ready", "closed"}
          /\ current \in BOOLEAN /\ alive \in BOOLEAN /\ ownLock \in BOOLEAN
          /\ recoveryLock \in BOOLEAN /\ deleted \in BOOLEAN
          /\ orphan \in 1..2 /\ seen \in 0..2 /\ generation \in 0..2
          /\ local \in 0..2 /\ accepted \in 0..2 /\ request \in 0..2 /\ flight \in 0..2
          /\ journal \subseteq 1..2 /\ cleared \subseteq 1..2
=============================================================================
