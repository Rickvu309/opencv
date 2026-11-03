---- MODULE TakeClaim ----
EXTENDS Integers, Sequences

CONSTANTS Agents, Foreign, Confirm, TrustAt, Idle, Skew, MaxTime, MaxComments

VARIABLES comments, now, pc, seen, postAt, doneAt, last

vars == <<comments, now, pc, seen, postAt, doneAt, last>>

Far == MaxTime + Idle + 1

NoHolder == [state |-> "none", agent |-> "none", lease |-> -1]

LeaseAt(c, n) ==
    IF TrustAt THEN c.at
    ELSE IF c.stamp > n + Skew THEN -1 ELSE c.stamp

HolderOf(cs, n) ==
    IF cs = <<>> THEN NoHolder
    ELSE LET c == cs[Len(cs)] IN
        IF c.kind = "release"
            THEN [state |-> "released", agent |-> c.agent, lease |-> -1]
            ELSE LET l == LeaseAt(c, n) IN
                [state |-> IF l # -1 /\ n - l < Idle THEN "live" ELSE "idle",
                 agent |-> c.agent,
                 lease |-> l]

Holder == HolderOf(comments, now)

HeldByOther(h, a) == h.state = "live" /\ h.agent # a

Holds(h, a) == h.agent = a /\ h.state \in {"live", "idle"}

Init ==
    /\ comments = <<>>
    /\ now = 0
    /\ pc = [a \in Agents |-> "start"]
    /\ seen = [a \in Agents |-> NoHolder]
    /\ postAt = [a \in Agents |-> 0]
    /\ doneAt = [a \in Agents |-> 0]
    /\ last = <<"env", "Init">>

TakeRead(a) ==
    /\ pc[a] = "start"
    /\ seen' = [seen EXCEPT ![a] = Holder]
    /\ pc' = [pc EXCEPT ![a] = IF HeldByOther(Holder, a) THEN "refused" ELSE "read"]
    /\ last' = <<a, "TakeRead">>
    /\ UNCHANGED <<comments, now, postAt, doneAt>>

TakeRaced(a) ==
    /\ pc[a] = "read"
    /\ seen' = [seen EXCEPT ![a] = Holder]
    /\ pc' = [pc EXCEPT ![a] = IF HeldByOther(Holder, a) THEN "refused" ELSE "raced"]
    /\ last' = <<a, "TakeRaced">>
    /\ UNCHANGED <<comments, now, postAt, doneAt>>

PostClaim(a) ==
    /\ pc[a] = "raced"
    /\ comments' = Append(comments, [kind |-> "claim", agent |-> a, at |-> now, stamp |-> now])
    /\ postAt' = [postAt EXCEPT ![a] = Len(comments) + 1]
    /\ pc' = [pc EXCEPT ![a] = "posted"]
    /\ last' = <<a, "PostClaim">>
    /\ UNCHANGED <<now, seen, doneAt>>

ConfirmRead(a) ==
    /\ pc[a] = "posted"
    /\ seen' = [seen EXCEPT ![a] = Holder]
    /\ pc' = [pc EXCEPT ![a] =
            IF ~Confirm \/ (Holder.state = "live" /\ Holder.agent = a) THEN "won" ELSE "lost"]
    /\ doneAt' = [doneAt EXCEPT ![a] = Len(comments)]
    /\ last' = <<a, "ConfirmRead">>
    /\ UNCHANGED <<comments, now, postAt>>

Save(a) ==
    /\ pc[a] = "won"
    /\ seen' = [seen EXCEPT ![a] = Holder]
    /\ IF Holds(Holder, a)
        THEN /\ LET i == Len(comments) IN
                    comments' = [comments EXCEPT ![i].at = comments[i].stamp, ![i].stamp = now]
             /\ UNCHANGED pc
        ELSE /\ pc' = [pc EXCEPT ![a] = "lost"]
             /\ UNCHANGED comments
    /\ last' = <<a, "Save">>
    /\ UNCHANGED <<now, postAt, doneAt>>

Tick ==
    /\ now < MaxTime
    /\ now' = now + 1
    /\ last' = <<"env", "Tick">>
    /\ UNCHANGED <<comments, pc, seen, postAt, doneAt>>

ForeignClaim ==
    /\ Len(comments) < MaxComments
    /\ \E at \in {now, Far}, stamp \in {now, now + Skew + 1} :
        comments' = Append(comments, [kind |-> "claim", agent |-> Foreign, at |-> at, stamp |-> stamp])
    /\ last' = <<"env", "ForeignClaim">>
    /\ UNCHANGED <<now, pc, seen, postAt, doneAt>>

ForeignRelease ==
    /\ Len(comments) < MaxComments
    /\ comments' = Append(comments, [kind |-> "release", agent |-> Foreign, at |-> now, stamp |-> now])
    /\ last' = <<"env", "ForeignRelease">>
    /\ UNCHANGED <<now, pc, seen, postAt, doneAt>>

Next ==
    \/ \E a \in Agents : TakeRead(a)
    \/ \E a \in Agents : TakeRaced(a)
    \/ \E a \in Agents : PostClaim(a)
    \/ \E a \in Agents : ConfirmRead(a)
    \/ \E a \in Agents : Save(a)
    \/ Tick
    \/ ForeignClaim
    \/ ForeignRelease

Spec == Init /\ [][Next]_vars

TwoTakesNeverBothLive ==
    \A a, b \in Agents :
        (a # b /\ pc[a] = "won" /\ pc[b] = "won" /\ postAt[a] < postAt[b])
            => doneAt[a] < postAt[b]

WinnerHoldsAtReturn ==
    \A a \in Agents :
        (last = <<a, "ConfirmRead">> /\ pc[a] = "won")
            => Holder.state = "live" /\ Holder.agent = a

FutureStampNeverHolds ==
    Holder.state = "live" =>
        LET c == comments[Len(comments)] IN
            /\ c.stamp <= now + Skew
            /\ now - c.stamp < Idle

====
