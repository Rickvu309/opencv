---- MODULE ContentStore ----
EXTENDS Integers

CONSTANTS RevisionGuard, SeqFromEntry, VersionCheck, SyncCheck, CoachStrict, Max

Blocks == {"b1", "b2"}
Procs == {"a", "b"}
None == "none"

VARIABLES
  version, logMax, gap, person,
  cacheP, cacheR, cacheD, cacheAhead,
  lock, snap, saved, savedGap, drev, dperson, dirty, writes,
  lost, blocked, coached, coachAt, coachRead, basis, sentVer

vars == <<
  version, logMax, gap, person,
  cacheP, cacheR, cacheD, cacheAhead,
  lock, snap, saved, savedGap, drev, dperson, dirty, writes,
  lost, blocked, coached, coachAt, coachRead, basis, sentVer
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
  /\ coachAt = None
  /\ coachRead = 0
  /\ basis = 1
  /\ sentVer = 0

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

remember(p, seq, page) ==
  /\ cacheP' = [cacheP EXCEPT ![p] = TRUE]
  /\ cacheR' = [cacheR EXCEPT ![p] = seq]
  /\ cacheD' = [cacheD EXCEPT ![p] = page]
  /\ cacheAhead' = [cacheAhead EXCEPT ![p] = FALSE]

publish(seq, page) ==
  /\ version' = seq
  /\ logMax' = IF seq = logMax + 1 THEN seq ELSE logMax
  /\ gap' = (gap \/ (seq # (logMax + 1)))
  /\ drev' = seq
  /\ dperson' = page

coachOk(basedOn, revision) ==
  IF CoachStrict THEN basedOn = revision
  ELSE basedOn <= revision /\ basedOn >= 1

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
  /\ UNCHANGED <<
       version, logMax, gap, person, lost, blocked, coached,
       coachAt, coachRead, basis, sentVer
     >>

Person(p) ==
  /\ lock = p
  /\ writes < 2
  /\ version < Max
  /\ \E b \in Blocks :
       /\ ~dperson[b]
       /\ \E basedOn \in 1..drev :
            /\ basedOn = drev \/ ~SyncCheck
            /\ dperson' = [dperson EXCEPT ![b] = TRUE]
            /\ dirty' = TRUE
            /\ basis' = basedOn
            /\ UNCHANGED <<
                 version, logMax, gap, person,
                 cacheP, cacheR, cacheD, cacheAhead,
                 lock, snap, saved, savedGap, drev, writes,
                 lost, blocked, coached, coachAt, coachRead, sentVer
               >>

Commit(p) ==
  /\ lock = p
  /\ dirty
  /\ LET seq == IF SeqFromEntry THEN drev + 1 ELSE snap + 1
     IN /\ seq <= Max
        /\ publish(seq, dperson)
        /\ person' = dperson
        /\ dirty' = FALSE
        /\ writes' = writes + 1
        /\ remember(p, seq, dperson)
        /\ UNCHANGED <<
             lock, snap, saved, savedGap,
             lost, blocked, coached, coachAt, coachRead, basis, sentVer
           >>

Coach(p) ==
  /\ lock = p
  /\ ~dirty
  /\ writes = 0
  /\ ~coached
  /\ \E touched \in Blocks :
       /\ person[touched]
       /\ \E free \in Blocks :
            /\ free # touched
            /\ ~person[free]
            /\ \E basedOn \in 1..version :
                 IF coachOk(basedOn, version) /\ version < Max
                 THEN /\ publish(version + 1, person)
                      /\ remember(p, version + 1, person)
                      /\ coached' = TRUE
                      /\ blocked' = FALSE
                      /\ coachAt' = free
                      /\ coachRead' = basedOn
                      /\ UNCHANGED <<
                           person, lock, snap, saved, savedGap, dirty, writes,
                           lost, basis, sentVer
                         >>
                 ELSE /\ CoachStrict
                      /\ basedOn < version
                      /\ blocked' = TRUE
                      /\ coached' = TRUE
                      /\ coachRead' = basedOn
                      /\ UNCHANGED <<
                           version, logMax, gap, person,
                           cacheP, cacheR, cacheD, cacheAhead,
                           lock, snap, saved, savedGap, drev, dperson, dirty, writes,
                           lost, coachAt, basis, sentVer
                         >>

Replace(p) ==
  /\ lock = p
  /\ ~dirty
  /\ writes = 0
  /\ version < Max
  /\ \E marked \in Blocks :
       /\ person[marked]
       /\ \E sent \in 1..version :
            IF sent = version
            THEN /\ publish(version + 1, person)
                 /\ remember(p, version + 1, person)
                 /\ sentVer' = sent
                 /\ UNCHANGED <<
                      person, lock, snap, saved, savedGap, dirty, writes,
                      lost, blocked, coached, coachAt, coachRead, basis
                    >>
            ELSE /\ ~VersionCheck
                 /\ publish(version + 1, blank)
                 /\ person' = blank
                 /\ lost' = TRUE
                 /\ remember(p, version + 1, blank)
                 /\ sentVer' = sent
                 /\ UNCHANGED <<
                      lock, snap, saved, savedGap, dirty, writes,
                      blocked, coached, coachAt, coachRead, basis
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
       lost, blocked, coached, coachAt, coachRead, basis, sentVer
     >>

End(p) ==
  /\ lock = p
  /\ lock' = None
  /\ dirty' = FALSE
  /\ UNCHANGED <<
       version, logMax, gap, person,
       cacheP, cacheR, cacheD, cacheAhead,
       snap, saved, savedGap, drev, dperson, writes,
       lost, blocked, coached, coachAt, coachRead, basis, sentVer
     >>

Evict(p) ==
  /\ lock = None
  /\ cacheP[p]
  /\ cacheP' = [cacheP EXCEPT ![p] = FALSE]
  /\ UNCHANGED <<
       version, logMax, gap, person,
       cacheR, cacheD, cacheAhead,
       lock, snap, saved, savedGap, drev, dperson, dirty, writes,
       lost, blocked, coached, coachAt, coachRead, basis, sentVer
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
  /\ coachAt \in Blocks \cup {None}
  /\ coachRead \in 0..Max
  /\ basis \in 0..Max
  /\ sentVer \in 0..Max

P1 == (lock # None /\ ~dirty) => (dperson = person /\ drev = version)

P2 == version = logMax /\ ~gap

P3 == ~lost

CoachExact == [][(~coached /\ coached' /\ ~blocked') => coachRead' = version]_vars

P5 == ~dirty \/ basis = drev

====
