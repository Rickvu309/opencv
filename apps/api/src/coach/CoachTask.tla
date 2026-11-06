---- MODULE CoachTask ----
EXTENDS Naturals, Sequences, FiniteSets
CONSTANTS Fence, BindIntent, CancelFence, AmbientJoin
VARIABLES proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt
vars == <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Workers == {"A", "B"}
Init == /\ proposal = "none" /\ approvedAfterCancel = FALSE /\ cursor = 0 /\ projection = <<>>
        /\ epoch = 0 /\ owner = "none" /\ until = 0 /\ now = 0
        /\ leases = [w \in Workers |-> 0] /\ decision = FALSE /\ effect = 0
        /\ events = <<>> /\ cancelled = FALSE /\ terminal = FALSE
        /\ checkpoint = FALSE /\ badWrite = FALSE /\ lockedBy = "none"
        /\ checked = FALSE /\ checkedAt = 0 /\ lastStatementAt = 0
Live(w) == /\ ~terminal /\ leases[w] > 0
           /\ (~Fence \/ (owner = w /\ leases[w] = epoch /\ now < until))
Claim(w) == /\ lockedBy = "none" /\ ~terminal /\ epoch < 2 /\ (owner = "none" \/ now >= until)
            /\ epoch' = epoch + 1 /\ owner' = w /\ until' = now + 1
            /\ leases' = [leases EXCEPT ![w] = epoch']
            /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, now, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Renew(w) == /\ lockedBy = "none" /\ Live(w) /\ until < 3 /\ until' = until + 1
            /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Expire == /\ now < 3 /\ now' = now + 1
          /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Persist(w) == /\ lockedBy = "none" /\ Live(w) /\ ~cancelled /\ ~decision /\ decision' = TRUE
              /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Begin(w) == /\ lockedBy = "none" /\ Live(w) /\ decision /\ (~CancelFence \/ ~cancelled)
            /\ (effect = 0 \/ ~BindIntent) /\ effect < 2 /\ lockedBy' = w /\ checked' = FALSE
            /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, checkedAt, lastStatementAt>>
Check(w) == /\ lockedBy = w /\ ~checked /\ Live(w) /\ (~CancelFence \/ ~cancelled)
            /\ checked' = TRUE /\ checkedAt' = now /\ lastStatementAt' = now
            /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy>>
CallerStatement(w) == /\ AmbientJoin /\ lockedBy = w /\ checked /\ lastStatementAt < now
                      /\ lastStatementAt' = now
                      /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt>>
Commit(w) == /\ lockedBy = w /\ checked
             /\ effect' = effect + 1 /\ events' = Append(events, effect')
             /\ badWrite' = (badWrite \/ owner # w \/ leases[w] # epoch \/ lastStatementAt >= until \/ cancelled)
             /\ lockedBy' = "none" /\ checked' = FALSE
             /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, cancelled, terminal, checkpoint, checkedAt, lastStatementAt>>
Abort(w) == /\ lockedBy = w /\ lockedBy' = "none" /\ checked' = FALSE
            /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, checkedAt, lastStatementAt>>
Recover(w) == /\ lockedBy = "none" /\ Live(w) /\ effect = 1 /\ ~checkpoint /\ checkpoint' = TRUE
              /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Cancel == /\ lockedBy = "none" /\ ~terminal /\ ~cancelled /\ cancelled' = TRUE
          /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Finalize(w) == /\ lockedBy = "none" /\ Live(w) /\ (cancelled \/ checkpoint) /\ terminal' = TRUE
               /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, leases, decision, effect, events, cancelled, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt>>
Crash(w) == /\ leases[w] > 0 /\ leases' = [leases EXCEPT ![w] = 0]
            /\ lockedBy' = IF lockedBy = w THEN "none" ELSE lockedBy
            /\ checked' = IF lockedBy = w THEN FALSE ELSE checked
            /\ UNCHANGED <<proposal, approvedAfterCancel, cursor, projection, epoch, owner, until, now, decision, effect, events, cancelled, terminal, checkpoint, badWrite, checkedAt, lastStatementAt>>
Propose(w) == /\ lockedBy = "none" /\ Live(w) /\ decision /\ ~cancelled /\ effect = 0 /\ proposal = "none"
              /\ proposal' = "pending"
              /\ UNCHANGED <<epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt, approvedAfterCancel, cursor, projection>>
Approve == /\ lockedBy = "none" /\ ~terminal /\ proposal = "pending" /\ effect = 0
           /\ (~CancelFence \/ ~cancelled)
           /\ proposal' = "approved" /\ effect' = 1 /\ events' = Append(events, 1)
           /\ approvedAfterCancel' = cancelled
           /\ UNCHANGED <<epoch, owner, until, now, leases, decision, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt, cursor, projection>>
Deny == /\ lockedBy = "none" /\ ~terminal /\ ~cancelled /\ proposal = "pending"
        /\ proposal' = "denied"
        /\ UNCHANGED <<epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt, approvedAfterCancel, cursor, projection>>
Replay == /\ Len(events) > 0 /\ Len(projection) < 2
          /\ IF BindIntent THEN cursor < Len(events) ELSE TRUE
          /\ cursor' = IF BindIntent THEN cursor + 1 ELSE 1
          /\ projection' = Append(projection, events[cursor'])
          /\ UNCHANGED <<epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite, lockedBy, checked, checkedAt, lastStatementAt, proposal, approvedAfterCancel>>
Next == Expire \/ Cancel \/ Approve \/ Deny \/ Replay \/ (\E w \in Workers : Propose(w) \/ Claim(w) \/ Renew(w) \/ Persist(w) \/ Begin(w) \/ Check(w) \/ CallerStatement(w) \/ Commit(w) \/ Abort(w) \/ Recover(w) \/ Finalize(w) \/ Crash(w))
Spec == Init /\ [][Next]_vars
ApprovalFence == ~approvedAfterCancel
ReplayProjection == projection = SubSeq(events, 1, cursor)
Fenced == ~badWrite
ExactlyOnce == effect <= 1
Receipt == Len(events) = effect /\ (effect > 0 => decision)
Prefix == \A i \in 1..Len(events) : events[i] = i
====
