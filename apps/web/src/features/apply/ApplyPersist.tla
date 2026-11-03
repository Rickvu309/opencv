---- MODULE ApplyPersist ----
EXTENDS Naturals, Sequences

CONSTANTS Cards, Stages, MaxDrops, Guard, Override

VARIABLES server, cache, ov, queue, intent, fetch, n, refreshBad

vars == <<server, cache, ov, queue, intent, fetch, n, refreshBad>>

None == "none"
Start == "saved"

Idle(qs) == \A d \in Cards : qs[d] = <<>>
Shown(c) == IF Override /\ ov[c] # None THEN ov[c] ELSE cache[c]
NoFetch == [on |-> FALSE, snap |-> [c \in Cards |-> Start], clears |-> FALSE]
FetchClears == fetch.on /\ fetch.clears

Init ==
  /\ server = [c \in Cards |-> Start]
  /\ cache = [c \in Cards |-> Start]
  /\ ov = [c \in Cards |-> None]
  /\ queue = [c \in Cards |-> <<>>]
  /\ intent = [c \in Cards |-> None]
  /\ fetch = NoFetch
  /\ n = 0
  /\ refreshBad = FALSE

Drop(c, s) ==
  /\ n < MaxDrops
  /\ intent' = [intent EXCEPT ![c] = s]
  /\ IF Shown(c) = s
        THEN UNCHANGED <<cache, ov, queue, fetch, n>>
        ELSE /\ ov' = [ov EXCEPT ![c] = s]
             /\ cache' = [cache EXCEPT ![c] = s]
             /\ queue' = [queue EXCEPT ![c] = Append(@, s)]
             /\ n' = n + 1
             /\ fetch' = IF Override THEN fetch ELSE NoFetch
  /\ UNCHANGED <<server, refreshBad>>

Commit(c) ==
  /\ queue[c] # <<>>
  /\ server' = [server EXCEPT ![c] = Head(queue[c])]
  /\ queue' = [queue EXCEPT ![c] = Tail(@)]
  /\ IF ~Guard \/ Idle(queue')
        THEN fetch' = [on |-> TRUE, snap |-> server', clears |-> TRUE]
        ELSE UNCHANGED fetch
  /\ refreshBad' = (refreshBad \/ (~Guard /\ ~Idle(queue')))
  /\ UNCHANGED <<cache, ov, intent, n>>

Refetch ==
  /\ ~FetchClears
  /\ fetch' = [on |-> TRUE, snap |-> server, clears |-> FALSE]
  /\ UNCHANGED <<server, cache, ov, queue, intent, n, refreshBad>>

Land ==
  /\ fetch.on
  /\ cache' = fetch.snap
  /\ ov' = IF fetch.clears /\ Idle(queue) THEN [c \in Cards |-> None] ELSE ov
  /\ fetch' = NoFetch
  /\ UNCHANGED <<server, queue, intent, n, refreshBad>>

Next ==
  \/ \E c \in Cards, s \in Stages : Drop(c, s)
  \/ \E c \in Cards : Commit(c)
  \/ Refetch
  \/ Land

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ \A c \in Cards : server[c] \in Stages /\ cache[c] \in Stages
  /\ \A c \in Cards : ov[c] \in Stages \cup {None}
  /\ n \in 0..MaxDrops

ShownIsIntent == \A c \in Cards : intent[c] # None => Shown(c) = intent[c]

ServerIsIntent == Idle(queue) => \A c \in Cards : intent[c] # None => server[c] = intent[c]

RefreshOnlyWhenIdle == ~refreshBad
====
