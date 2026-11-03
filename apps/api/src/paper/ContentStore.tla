---- MODULE ContentStore ----
EXTENDS Integers

CONSTANTS RevisionGuard, SeqFromEntry, VersionCheck, Max

Blocks == {"b1", "b2"}
Procs == {"a", "b"}
None == "none"

VARIABLES
  version, logMax, gap, person,
  cacheP, cacheR, cacheD, cacheAhead,
  lock, snap, saved, savedGap, drev, dperson, dirty, writes,
  lost, blocked, coached

vars == <<
  version, logMax, gap, person,
  cacheP, cacheR, cacheD, cacheAhead,
  lock, snap, saved, savedGap, drev, dperson, dirty, writes,
  lost, blocked, coached
>>

blank == [b \in Blocks |-> FALSE]

Init ==
  /\ version = 1
  /\ logMax = 1
  /\ gap = FALSE
  /\ person = blank
  /\ cacheP = [p \in Procs |-> FALSE]
  /\ cacheR = [p \in Procs |-> 0]
  /\ cacheD = [p \in Procs |-> blank]
  /\ cacheAhead = [p \in Procs |-> FALSE]
  /\ lock = None
  /\ snap = 1
  /\ saved = blank
  /\ savedGap = FALSE
  /\ drev = 1
  /\ dperson = blank
  /\ dirty = FALSE
  /\ writes = 0
  /\ lost = FALSE
  /\ blocked = FALSE
  /\ coached = FALSE

usable(p) ==
  /\ cacheP[p]
  /\ ~cacheAhead[p]
  /\ cacheR[p] = version
  /\ cacheD[p] = person

ahead(p) ==
  /\ ~RevisionGuard
  /\ cacheP[p]
  /\ cacheAhead[p]
  /\ cacheR[p] > version

Lock(p) ==
  /\ lock = None
  /\ lock' = p
  /\ snap' = version
  /\ saved' = person
  /\ savedGap' = gap
  /\ writes' = 0
  /\ dirty' = FALSE
  /\ IF usable(p) \/ ahead(p)
       THEN /\ drev' = cacheR[p]
            /\ dperson' = cacheD[p]
            /\ UNCHANGED <<cacheP, cacheR, cacheD, cacheAhead>>
       ELSE /\ drev' = version
            /\ dperson' = person
            /\ cacheP' = [cacheP EXCEPT ![p] = TRUE]
            /\ cacheR' = [cacheR EXCEPT ![p] = version]
            /\ cacheD' = [cacheD EXCEPT ![p] = person]
            /\ cacheAhead' = [cacheAhead EXCEPT ![p] = FALSE]
  /\ UNCHANGED <<version, logMax, gap, person, lost, blocked, coached>>

Person(p) ==
  /\ lock = p
  /\ writes < 2
  /\ version < Max
  /\ \E b \in Blocks :
       /\ ~dperson[b]
       /\ dperson' = [dperson EXCEPT ![b] = TRUE]
  /\ dirty' = TRUE
  /\ UNCHANGED <<
       version, logMax, gap, person,
       cacheP, cacheR, cacheD, cacheAhead,
       lock, snap, saved, savedGap, drev, writes,
       lost, blocked, coached
     >>

Commit(p) ==
  /\ lock = p
  /\ dirty
  /\ LET seq == IF SeqFromEntry THEN drev + 1 ELSE snap + 1
     IN /\ seq <= Max
        /\ version' = seq
        /\ logMax' = IF seq = logMax + 1 THEN seq ELSE logMax
        /\ gap' = (gap \/ (seq # (logMax + 1)))
        /\ person' = dperson
        /\ drev' = seq
        /\ dirty' = FALSE
        /\ writes' = writes + 1
        /\ cacheP' = [cacheP EXCEPT ![p] = TRUE]
        /\ cacheR' = [cacheR EXCEPT ![p] = seq]
        /\ cacheD' = [cacheD EXCEPT ![p] = dperson]
        /\ cacheAhead' = [cacheAhead EXCEPT ![p] = FALSE]
        /\ UNCHANGED <<
             lock, snap, saved, savedGap, dperson,
             lost, blocked, coached
           >>

Coach(p) ==
  /\ lock = p
  /\ ~dirty
  /\ writes = 0
  /\ ~coached
  /\ \E b \in Blocks : person[b]
  /\ \E c \in Blocks : ~person[c]
  /\ coached' = TRUE
  /\ blocked' = FALSE
  /\ UNCHANGED <<
       version, logMax, gap, person,
       cacheP, cacheR, cacheD, cacheAhead,
       lock, snap, saved, savedGap, drev, dperson, dirty, writes,
       lost
     >>

Replace(p) ==
  /\ lock = p
  /\ ~dirty
  /\ writes = 0
  /\ version < Max
  /\ \E b \in Blocks : person[b]
  /\ IF VersionCheck
       THEN UNCHANGED vars
       ELSE /\ person' = blank
            /\ lost' = TRUE
            /\ version' = version + 1
            /\ logMax' = logMax + 1
            /\ drev' = version + 1
            /\ dperson' = blank
            /\ cacheP' = [cacheP EXCEPT ![p] = TRUE]
            /\ cacheR' = [cacheR EXCEPT ![p] = version + 1]
            /\ cacheD' = [cacheD EXCEPT ![p] = blank]
            /\ cacheAhead' = [cacheAhead EXCEPT ![p] = FALSE]
            /\ UNCHANGED <<
                 gap, lock, snap, saved, savedGap, dirty, writes,
                 blocked, coached
               >>

Rollback(p) ==
  /\ lock = p
  /\ writes > 0
  /\ version' = snap
  /\ logMax' = snap
  /\ person' = saved
  /\ gap' = savedGap
  /\ cacheAhead' = [cacheAhead EXCEPT ![p] = TRUE]
  /\ lock' = None
  /\ dirty' = FALSE
  /\ writes' = 0
  /\ UNCHANGED <<
       cacheP, cacheR, cacheD,
       snap, saved, savedGap, drev, dperson,
       lost, blocked, coached
     >>

End(p) ==
  /\ lock = p
  /\ lock' = None
  /\ dirty' = FALSE
  /\ UNCHANGED <<
       version, logMax, gap, person,
       cacheP, cacheR, cacheD, cacheAhead,
       snap, saved, savedGap, drev, dperson, writes,
       lost, blocked, coached
     >>

Evict(p) ==
  /\ lock = None
  /\ cacheP[p]
  /\ cacheP' = [cacheP EXCEPT ![p] = FALSE]
  /\ UNCHANGED <<
       version, logMax, gap, person,
       cacheR, cacheD, cacheAhead,
       lock, snap, saved, savedGap, drev, dperson, dirty, writes,
       lost, blocked, coached
     >>

Next ==
  \/ \E p \in Procs : Lock(p)
  \/ \E p \in Procs : Person(p)
  \/ \E p \in Procs : Commit(p)
  \/ \E p \in Procs : Coach(p)
  \/ \E p \in Procs : Replace(p)
  \/ \E p \in Procs : Rollback(p)
  \/ \E p \in Procs : End(p)
  \/ \E p \in Procs : Evict(p)

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ version \in 1..Max
  /\ logMax \in 1..Max
  /\ gap \in BOOLEAN
  /\ person \in [Blocks -> BOOLEAN]
  /\ cacheP \in [Procs -> BOOLEAN]
  /\ cacheR \in [Procs -> 0..Max]
  /\ cacheD \in [Procs -> [Blocks -> BOOLEAN]]
  /\ cacheAhead \in [Procs -> BOOLEAN]
  /\ lock \in Procs \cup {None}
  /\ snap \in 1..Max
  /\ saved \in [Blocks -> BOOLEAN]
  /\ savedGap \in BOOLEAN
  /\ drev \in 0..Max
  /\ dperson \in [Blocks -> BOOLEAN]
  /\ dirty \in BOOLEAN
  /\ writes \in 0..2
  /\ lost \in BOOLEAN
  /\ blocked \in BOOLEAN
  /\ coached \in BOOLEAN

P1 == (lock # None /\ ~dirty) => (dperson = person /\ drev = version)

P2 == version = logMax /\ ~gap

P3 == ~lost

P4 == ~blocked

====
