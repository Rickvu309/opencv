---- MODULE MergeWait ----
EXTENDS Integers

CONSTANTS HeadCheck, Limit, RequeueOnce, Handoff, LimitSteps, HoldSteps, MaxEnv

VARIABLES head, start, prState, mergedHead, inQueue, removed, ci, pc,
          waited, holdUntil, reran, requeued, requeues, reported, snap, verdict, env

vars == <<head, start, prState, mergedHead, inQueue, removed, ci, pc,
          waited, holdUntil, reran, requeued, requeues, reported, snap, verdict, env>>

Enqueued == "h1"

NoSnap == [state |-> "none", head |-> "none", inQueue |-> FALSE, ci |-> "none",
           removed |-> "none", waited |-> 0]

Snapshot == [state |-> prState, head |-> head, inQueue |-> inQueue, ci |-> ci,
             removed |-> removed, waited |-> waited]

Classify(s) ==
    IF HeadCheck /\ s.head # start THEN "HEAD_MOVED"
    ELSE IF s.state = "MERGED" THEN "MERGED"
    ELSE IF s.state = "CLOSED" THEN "LEFT_QUEUE"
    ELSE IF ~s.inQueue /\ s.ci \in {"failure", "infra"} THEN "CI_FAILED"
    ELSE IF ~s.inQueue /\ s.removed # "none" THEN "LEFT_QUEUE"
    ELSE IF Limit /\ s.waited >= LimitSteps THEN "QUEUE_TIMEOUT"
    ELSE "none"

Min(a, b) == IF a < b THEN a ELSE b

Init ==
    /\ head = Enqueued
    /\ start = Enqueued
    /\ prState = "OPEN"
    /\ mergedHead = "none"
    /\ inQueue = FALSE
    /\ removed = "none"
    /\ ci = "success"
    /\ pc = "enqueue"
    /\ waited = 0
    /\ holdUntil = 0
    /\ reran = FALSE
    /\ requeued = FALSE
    /\ requeues = 0
    /\ reported = "none"
    /\ snap = NoSnap
    /\ verdict = "none"
    /\ env = 0

Finish(kind) ==
    /\ reported' = kind
    /\ pc' = "done"

Enqueue ==
    /\ pc = "enqueue"
    /\ IF prState = "OPEN" /\ head = start
        THEN /\ inQueue' = TRUE
             /\ pc' = IF Handoff THEN "handoff" ELSE "view"
             /\ UNCHANGED reported
        ELSE /\ Finish("ENQUEUE_FAILED")
             /\ UNCHANGED inQueue
    /\ UNCHANGED <<head, start, prState, mergedHead, removed, ci, waited, holdUntil,
                   reran, requeued, requeues, snap, verdict, env>>

WaitProcessStarts ==
    /\ pc = "handoff"
    /\ CASE prState = "MERGED" ->
                /\ Finish("MERGED")
                /\ UNCHANGED <<start, inQueue>>
         [] prState = "OPEN" /\ ci = "success" ->
                /\ start' = head
                /\ inQueue' = TRUE
                /\ pc' = "view"
                /\ UNCHANGED reported
         [] OTHER ->
                /\ Finish("REFUSED")
                /\ UNCHANGED <<start, inQueue>>
    /\ UNCHANGED <<head, prState, mergedHead, removed, ci, waited, holdUntil,
                   reran, requeued, requeues, snap, verdict, env>>

ViewAfterEnqueue ==
    /\ pc = "view"
    /\ IF prState = "MERGED" /\ head = start
        THEN Finish("MERGED")
        ELSE /\ pc' = "wait"
             /\ UNCHANGED reported
    /\ UNCHANGED <<head, start, prState, mergedHead, inQueue, removed, ci, waited,
                   holdUntil, reran, requeued, requeues, snap, verdict, env>>

Poll ==
    /\ pc = "wait"
    /\ LET s == Snapshot
           found == Classify(s)
           v == IF found = "CI_FAILED" /\ waited < holdUntil THEN "none" ELSE found
           requeue == /\ v = "none"
                      /\ waited >= holdUntil
                      /\ reran
                      /\ (RequeueOnce => ~requeued)
                      /\ ~inQueue
                      /\ ci = "success"
           rerun == v = "CI_FAILED" /\ ci = "infra" /\ ~reran
       IN
        /\ snap' = s
        /\ verdict' = found
        /\ waited' = Min(waited + 1, LimitSteps)
        /\ CASE v = "MERGED" ->
                    /\ Finish("MERGED")
                    /\ UNCHANGED <<inQueue, ci, holdUntil, reran, requeued, requeues>>
             [] requeue /\ head # start ->
                    /\ Finish("ENQUEUE_FAILED")
                    /\ UNCHANGED <<inQueue, ci, holdUntil, reran, requeued, requeues>>
             [] requeue ->
                    /\ inQueue' = TRUE
                    /\ requeued' = TRUE
                    /\ requeues' = requeues + 1
                    /\ UNCHANGED <<pc, reported, ci, holdUntil, reran>>
             [] rerun ->
                    /\ reran' = TRUE
                    /\ ci' = "pending"
                    /\ holdUntil' = waited + HoldSteps
                    /\ UNCHANGED <<pc, reported, inQueue, requeued, requeues>>
             [] v # "none" ->
                    /\ Finish(v)
                    /\ UNCHANGED <<inQueue, ci, holdUntil, reran, requeued, requeues>>
             [] OTHER ->
                    UNCHANGED <<pc, reported, inQueue, ci, holdUntil, reran, requeued, requeues>>
    /\ UNCHANGED <<head, start, prState, mergedHead, removed, env>>

Waiter == Enqueue \/ WaitProcessStarts \/ ViewAfterEnqueue \/ Poll

EnvStep ==
    /\ pc # "done"
    /\ env < MaxEnv
    /\ env' = env + 1

Quiet == UNCHANGED <<pc, start, waited, holdUntil, reran, requeued, requeues, reported, snap, verdict>>

QueueMerges ==
    /\ EnvStep
    /\ prState = "OPEN" /\ inQueue
    /\ prState' = "MERGED"
    /\ mergedHead' = head
    /\ inQueue' = FALSE
    /\ Quiet
    /\ UNCHANGED <<head, removed, ci>>

QueueRemoves ==
    /\ EnvStep
    /\ inQueue
    /\ inQueue' = FALSE
    /\ \E reason \in {"failed_checks", "other", "unrecorded"} :
        removed' = IF reason = "unrecorded" THEN removed ELSE reason
    /\ Quiet
    /\ UNCHANGED <<head, prState, mergedHead, ci>>

ForeignPush ==
    /\ EnvStep
    /\ prState = "OPEN" /\ head = "h1"
    /\ head' = "h2"
    /\ inQueue' = FALSE
    /\ removed' = IF inQueue THEN "other" ELSE removed
    /\ ci' = "pending"
    /\ Quiet
    /\ UNCHANGED <<prState, mergedHead>>

ForeignEnqueue ==
    /\ EnvStep
    /\ prState = "OPEN" /\ ~inQueue /\ ci = "success"
    /\ inQueue' = TRUE
    /\ Quiet
    /\ UNCHANGED <<head, prState, mergedHead, removed, ci>>

CiRestarts ==
    /\ EnvStep
    /\ prState = "OPEN" /\ ci # "pending"
    /\ ci' = "pending"
    /\ Quiet
    /\ UNCHANGED <<head, prState, mergedHead, inQueue, removed>>

CiFinishes ==
    /\ EnvStep
    /\ ci = "pending"
    /\ \E c \in {"success", "failure", "infra"} : ci' = c
    /\ Quiet
    /\ UNCHANGED <<head, prState, mergedHead, inQueue, removed>>

PrClosed ==
    /\ EnvStep
    /\ prState = "OPEN"
    /\ prState' = "CLOSED"
    /\ inQueue' = FALSE
    /\ Quiet
    /\ UNCHANGED <<head, mergedHead, removed, ci>>

Next ==
    \/ Enqueue
    \/ WaitProcessStarts
    \/ ViewAfterEnqueue
    \/ Poll
    \/ QueueMerges
    \/ QueueRemoves
    \/ ForeignPush
    \/ ForeignEnqueue
    \/ CiRestarts
    \/ CiFinishes
    \/ PrClosed

Spec == Init /\ [][Next]_vars /\ WF_vars(Waiter)

MergedOnlyAtEnqueuedHead ==
    reported = "MERGED" => mergedHead = Enqueued

LeftQueueNeverMerged ==
    reported = "MERGED" => prState = "MERGED"

RequeueAtMostOnce ==
    requeues <= 1

WaitEnds == <>(pc = "done")

====
