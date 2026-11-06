---- MODULE CoachTask ----
EXTENDS Naturals, Sequences, FiniteSets
CONSTANTS Fence, BindIntent, CancelFence
VARIABLES epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite
vars == <<epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite>>
Workers == {"A", "B"}
Init == /\ epoch = 0 /\ owner = "none" /\ until = 0 /\ now = 0
        /\ leases = [w \in Workers |-> 0] /\ decision = FALSE /\ effect = 0
        /\ events = <<>> /\ cancelled = FALSE /\ terminal = FALSE
        /\ checkpoint = FALSE /\ badWrite = FALSE
Live(w) == /\ ~terminal /\ leases[w] > 0
           /\ (~Fence \/ (owner = w /\ leases[w] = epoch /\ now < until))
Claim(w) == /\ ~terminal /\ epoch < 2 /\ (owner = "none" \/ now >= until)
            /\ epoch' = epoch + 1 /\ owner' = w /\ until' = now + 1
            /\ leases' = [leases EXCEPT ![w] = epoch']
            /\ UNCHANGED <<now, decision, effect, events, cancelled, terminal, checkpoint, badWrite>>
Renew(w) == /\ Live(w) /\ until < 3 /\ until' = until + 1
            /\ UNCHANGED <<epoch, owner, now, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite>>
Expire == /\ now < 3 /\ now' = now + 1
          /\ UNCHANGED <<epoch, owner, until, leases, decision, effect, events, cancelled, terminal, checkpoint, badWrite>>
Persist(w) == /\ Live(w) /\ ~cancelled /\ ~decision /\ decision' = TRUE
              /\ UNCHANGED <<epoch, owner, until, now, leases, effect, events, cancelled, terminal, checkpoint, badWrite>>
Commit(w) == /\ Live(w) /\ decision /\ (~CancelFence \/ ~cancelled)
             /\ (effect = 0 \/ ~BindIntent) /\ effect < 2
             /\ effect' = effect + 1 /\ events' = Append(events, effect')
             /\ badWrite' = (badWrite \/ owner # w \/ leases[w] # epoch \/ now >= until \/ cancelled)
             /\ UNCHANGED <<epoch, owner, until, now, leases, decision, cancelled, terminal, checkpoint>>
Recover(w) == /\ Live(w) /\ effect = 1 /\ ~checkpoint /\ checkpoint' = TRUE
              /\ UNCHANGED <<epoch, owner, until, now, leases, decision, effect, events, cancelled, terminal, badWrite>>
Cancel == /\ ~terminal /\ ~cancelled /\ cancelled' = TRUE
          /\ UNCHANGED <<epoch, owner, until, now, leases, decision, effect, events, terminal, checkpoint, badWrite>>
Finalize(w) == /\ Live(w) /\ (cancelled \/ checkpoint) /\ terminal' = TRUE
               /\ UNCHANGED <<epoch, owner, until, now, leases, decision, effect, events, cancelled, checkpoint, badWrite>>
Crash(w) == /\ leases[w] > 0 /\ leases' = [leases EXCEPT ![w] = 0]
            /\ UNCHANGED <<epoch, owner, until, now, decision, effect, events, cancelled, terminal, checkpoint, badWrite>>
Next == Expire \/ Cancel \/ (\E w \in Workers : Claim(w) \/ Renew(w) \/ Persist(w) \/ Commit(w) \/ Recover(w) \/ Finalize(w) \/ Crash(w))
Spec == Init /\ [][Next]_vars
Fenced == ~badWrite
ExactlyOnce == effect <= 1
Receipt == Len(events) = effect /\ (effect > 0 => decision)
Prefix == \A i \in 1..Len(events) : events[i] = i
====
