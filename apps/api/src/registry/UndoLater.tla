---- MODULE UndoLater ----
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS Policy, Fresh, MaxOps, MaxVer

VARIABLES cur, ver, log

vars == <<cur, ver, log>>

Fields == {"stage", "position"}
States == [Fields -> {0, 1}]
Start == [f \in Fields |-> 0]

Init ==
    /\ cur = Start
    /\ ver = 0
    /\ log = <<>>

Afters == {log[i].after : i \in {k \in 1..Len(log) : ~log[k].isUndo}}

Do(new) ==
    /\ Len(log) < MaxOps
    /\ ver < MaxVer
    /\ new # cur
    /\ Fresh => new \notin Afters
    /\ cur' = new
    /\ ver' = ver + 1
    /\ log' = Append(log, [before |-> cur, after |-> new, at |-> ver + 1, undone |-> FALSE, isUndo |-> FALSE])

Allowed(i) ==
    CASE Policy = "allow" -> TRUE
      [] Policy = "state" -> cur = log[i].after
      [] Policy = "version" -> ver = log[i].at
      [] Policy = "log" -> \A j \in (i + 1)..Len(log) : log[j].undone \/ log[j].isUndo
      [] Policy = "conditional" -> TRUE

Restored(i) ==
    IF Policy = "conditional"
        THEN [f \in Fields |-> IF cur[f] = log[i].after[f] THEN log[i].before[f] ELSE cur[f]]
        ELSE log[i].before

Undo(i) ==
    /\ Len(log) < MaxOps
    /\ ver < MaxVer
    /\ ~log[i].isUndo
    /\ ~log[i].undone
    /\ Allowed(i)
    /\ cur' = Restored(i)
    /\ ver' = ver + 1
    /\ log' = Append(
        [log EXCEPT ![i].undone = TRUE],
        [before |-> cur, after |-> Restored(i), at |-> ver + 1, undone |-> FALSE, isUndo |-> TRUE])

Next ==
    \/ \E new \in States : Do(new)
    \/ \E i \in 1..Len(log) : Undo(i)
    \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

Live == {i \in 1..Len(log) : ~log[i].undone /\ ~log[i].isUndo}

Latest == CHOOSE i \in Live : \A j \in Live : j <= i

TypeOK ==
    /\ cur \in States
    /\ ver \in 0..MaxVer
    /\ Len(log) <= MaxOps

NoLostEffect ==
    IF Live = {} THEN cur = Start ELSE cur = log[Latest].after

ChainUndo ==
    Live # {} => Allowed(Latest)

====
