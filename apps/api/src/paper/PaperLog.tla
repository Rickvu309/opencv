---- MODULE PaperLog ----
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Clients, MaxEdits, MaxSends, DropOnStale

VARIABLES log, ledger, floor, coached, typed, pending, base, lost, inflight, sends, replies, fault

vars == <<log, ledger, floor, coached, typed, pending, base, lost, inflight, sends, replies, fault>>

Range(s) == {s[i] : i \in 1..Len(s)}

Without(s, gone) == SelectSeq(s, LAMBDA e : e \notin gone)

Agrees(a, b, k) == \A i \in 1..k : a[i] = b[i]

OwnPrefix(since, mine) ==
  LET n == IF Len(since) < Len(mine) THEN Len(since) ELSE Len(mine)
  IN CHOOSE k \in 0..n : Agrees(since, mine, k) /\ (k = n \/ since[k + 1] # mine[k + 1])

Answer(c) ==
  IF base[c] < floor
  THEN [to |-> c, base |-> base[c], kind |-> "compacted", edits |-> <<>>,
        head |-> Len(log), landed |-> Range(pending[c]) \cap ledger]
  ELSE [to |-> c, base |-> base[c], kind |-> "stale",
        edits |-> SubSeq(log, base[c] + 1, Len(log)), head |-> Len(log), landed |-> {}]

Init ==
  /\ log = <<>>
  /\ ledger = {}
  /\ floor = 0
  /\ coached = 0
  /\ typed = [c \in Clients |-> 0]
  /\ pending = [c \in Clients |-> <<>>]
  /\ base = [c \in Clients |-> 0]
  /\ lost = [c \in Clients |-> {}]
  /\ inflight = [c \in Clients |-> FALSE]
  /\ sends = [c \in Clients |-> 0]
  /\ replies = {}
  /\ fault = FALSE

Type(c) ==
  /\ typed[c] < MaxEdits
  /\ typed' = [typed EXCEPT ![c] = @ + 1]
  /\ pending' = [pending EXCEPT ![c] = Append(@, <<c, typed[c] + 1>>)]
  /\ UNCHANGED <<log, ledger, floor, coached, base, lost, inflight, sends, replies, fault>>

Push(c) ==
  /\ ~inflight[c]
  /\ pending[c] # <<>>
  /\ sends[c] < MaxSends
  /\ inflight' = [inflight EXCEPT ![c] = TRUE]
  /\ sends' = [sends EXCEPT ![c] = @ + 1]
  /\ IF base[c] = Len(log)
     THEN /\ log' = log \o pending[c]
          /\ ledger' = ledger \cup Range(pending[c])
          /\ replies' = replies \cup {[to |-> c, base |-> base[c], kind |-> "ok",
                edits |-> pending[c], head |-> Len(log'), landed |-> {}]}
     ELSE /\ replies' = replies \cup {Answer(c)}
          /\ UNCHANGED <<log, ledger>>
  /\ UNCHANGED <<floor, coached, typed, pending, base, lost, fault>>

Pull(c) ==
  /\ base[c] < Len(log)
  /\ sends[c] < MaxSends
  /\ sends' = [sends EXCEPT ![c] = @ + 1]
  /\ replies' = replies \cup {Answer(c)}
  /\ UNCHANGED <<log, ledger, floor, coached, typed, pending, base, lost, inflight, fault>>

Coach ==
  /\ coached = 0
  /\ coached' = 1
  /\ log' = Append(log, <<"coach", 1>>)
  /\ ledger' = ledger \cup {<<"coach", 1>>}
  /\ UNCHANGED <<floor, typed, pending, base, lost, inflight, sends, replies, fault>>

Compact ==
  /\ floor < Len(log)
  /\ floor' = Len(log)
  /\ UNCHANGED <<log, ledger, coached, typed, pending, base, lost, inflight, sends, replies, fault>>

LoseReply(r) ==
  /\ r \in replies
  /\ replies' = replies \ {r}
  /\ UNCHANGED <<log, ledger, floor, coached, typed, pending, base, lost, inflight, sends, fault>>

Retry(c) ==
  /\ inflight[c]
  /\ \A r \in replies : r.to # c
  /\ inflight' = [inflight EXCEPT ![c] = FALSE]
  /\ UNCHANGED <<log, ledger, floor, coached, typed, pending, base, lost, sends, replies, fault>>

Reload(c) ==
  /\ inflight' = [inflight EXCEPT ![c] = FALSE]
  /\ replies' = {r \in replies : r.to # c}
  /\ UNCHANGED <<log, ledger, floor, coached, typed, pending, base, lost, sends, fault>>

Taken(r) ==
  /\ r \in replies
  /\ replies' = replies \ {r}
  /\ inflight' = [inflight EXCEPT ![r.to] = FALSE]

Ignore(r) ==
  /\ Taken(r)
  /\ r.base # base[r.to]
  /\ UNCHANGED <<log, ledger, floor, coached, typed, pending, base, lost, sends, fault>>

DeliverOk(r) ==
  /\ Taken(r)
  /\ r.kind = "ok"
  /\ r.base = base[r.to]
  /\ LET c == r.to
         n == Len(r.edits)
     IN /\ fault' = (fault \/ ~(n <= Len(pending[c]) /\ Agrees(r.edits, pending[c], n)))
        /\ pending' = [pending EXCEPT ![c] = SubSeq(@, n + 1, Len(@))]
        /\ base' = [base EXCEPT ![c] = r.head]
  /\ UNCHANGED <<log, ledger, floor, coached, typed, lost, sends>>

DeliverStale(r) ==
  /\ Taken(r)
  /\ r.kind = "stale"
  /\ r.base = base[r.to]
  /\ LET c == r.to
         k == OwnPrefix(r.edits, pending[c])
         rest == SubSeq(pending[c], k + 1, Len(pending[c]))
         stray == Range(SubSeq(r.edits, k + 1, Len(r.edits))) \cap Range(rest)
     IN /\ fault' = (fault \/ stray # {})
        /\ base' = [base EXCEPT ![c] = r.base + Len(r.edits)]
        /\ IF DropOnStale
           THEN /\ pending' = [pending EXCEPT ![c] = <<>>]
                /\ UNCHANGED lost
           ELSE \E gone \in SUBSET Range(rest) :
                  /\ pending' = [pending EXCEPT ![c] = Without(rest, gone)]
                  /\ lost' = [lost EXCEPT ![c] = @ \cup gone]
  /\ UNCHANGED <<log, ledger, floor, coached, typed, sends>>

DeliverCompacted(r) ==
  /\ Taken(r)
  /\ r.kind = "compacted"
  /\ r.base = base[r.to]
  /\ LET c == r.to
         rest == Without(pending[c], r.landed)
     IN /\ base' = [base EXCEPT ![c] = r.head]
        /\ \E gone \in SUBSET Range(rest) :
             /\ pending' = [pending EXCEPT ![c] = Without(rest, gone)]
             /\ lost' = [lost EXCEPT ![c] = @ \cup gone]
  /\ UNCHANGED <<log, ledger, floor, coached, typed, sends, fault>>

Next ==
  \/ \E c \in Clients : Type(c)
  \/ \E c \in Clients : Push(c)
  \/ \E c \in Clients : Pull(c)
  \/ Coach
  \/ Compact
  \/ \E r \in replies : LoseReply(r)
  \/ \E c \in Clients : Retry(c)
  \/ \E c \in Clients : Reload(c)
  \/ \E r \in replies : Ignore(r)
  \/ \E r \in replies : DeliverOk(r)
  \/ \E r \in replies : DeliverStale(r)
  \/ \E r \in replies : DeliverCompacted(r)

Spec == Init /\ [][Next]_vars

NoLoss ==
  \A c \in Clients : \A n \in 1..typed[c] :
    LET e == <<c, n>> IN e \in ledger \/ e \in Range(pending[c]) \/ e \in lost[c]

NoDuplicate == \A i, j \in 1..Len(log) : i # j => log[i] # log[j]

LostIsNotStored == \A c \in Clients : lost[c] \cap ledger = {}

InOrder == ~fault /\ \A c \in Clients : base[c] <= Len(log)

====
