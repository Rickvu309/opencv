---- MODULE PaperLocal ----
EXTENDS Naturals, Sequences, FiniteSets
CONSTANTS JournalOnInput, ResolveOnCommit
VARIABLES typed, editor, journal, requestValue, claimed, server, receipt, flight, phase, online, tried, reloaded, aborted
vars == <<typed, editor, journal, requestValue, claimed, server, receipt, flight, phase, online, tried, reloaded, aborted>>

Init == typed = 0 /\ editor = 0 /\ journal = 0 /\ requestValue = 0 /\ claimed = 0 /\ server = 0 /\ receipt = 0 /\ flight = 0 /\ phase = "Saved" /\ online = TRUE /\ tried = FALSE /\ reloaded = FALSE /\ aborted = FALSE
Type == /\ typed = 0
  /\ typed' = 1
  /\ editor' = 1
  /\ journal' = (IF JournalOnInput THEN 1 ELSE journal)
  /\ phase' = "Pending"
  /\ UNCHANGED <<requestValue, claimed, server, receipt, flight, online, tried, reloaded, aborted>>
LocalRequestSuccess == /\ editor = 1 /\ requestValue = 0 /\ ~aborted
  /\ requestValue' = editor
  /\ claimed' = (IF ResolveOnCommit THEN claimed ELSE editor)
  /\ UNCHANGED <<typed, editor, journal, server, receipt, flight, phase, online, tried, reloaded, aborted>>
LocalCommit == /\ requestValue = 1 /\ ~aborted /\ journal = 0
  /\ journal' = requestValue
  /\ claimed' = requestValue
  /\ UNCHANGED <<typed, editor, requestValue, server, receipt, flight, phase, online, tried, reloaded, aborted>>
LocalAbort == /\ requestValue = 1 /\ journal = 0 /\ ~aborted
  /\ requestValue' = 0
  /\ aborted' = TRUE
  /\ UNCHANGED <<typed, editor, journal, claimed, server, receipt, flight, phase, online, tried, reloaded>>
SendOrRetry == /\ online /\ editor = 1 /\ flight = 0 /\ phase # "Saved"
  /\ flight' = editor
  /\ phase' = "Saving"
  /\ tried' = TRUE
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, server, receipt, online, reloaded, aborted>>
AcceptDurably == /\ flight = 1 /\ server = 0
  /\ server' = flight
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, receipt, flight, phase, online, tried, reloaded, aborted>>
DeliverReply == /\ flight = 1 /\ server = flight /\ online
  /\ receipt' = flight
  /\ flight' = 0
  /\ phase' = (IF editor = flight THEN "Saved" ELSE "Pending")
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, server, online, tried, reloaded, aborted>>
LoseReply == /\ flight = 1 /\ server = flight
  /\ flight' = 0
  /\ phase' = "Retrying"
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, server, receipt, online, tried, reloaded, aborted>>
ServerFails == /\ flight = 1 /\ server = 0
  /\ flight' = 0
  /\ phase' = "Retrying"
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, server, receipt, online, tried, reloaded, aborted>>
GoOffline == /\ online
  /\ online' = FALSE
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, server, receipt, flight, phase, tried, reloaded, aborted>>
Reconnect == /\ ~online
  /\ online' = TRUE
  /\ UNCHANGED <<typed, editor, journal, requestValue, claimed, server, receipt, flight, phase, tried, reloaded, aborted>>
Reload == /\ typed = 1 /\ ~reloaded
  /\ reloaded' = TRUE
  /\ editor' = (IF journal = 1 \/ (online /\ server = 1) THEN 1 ELSE 0)
  /\ requestValue' = journal
  /\ phase' = "Reloaded"
  /\ flight' = 0
  /\ UNCHANGED <<typed, journal, claimed, server, receipt, online, tried, aborted>>
Next == Type \/ LocalRequestSuccess \/ LocalCommit \/ LocalAbort \/ SendOrRetry \/ AcceptDurably \/ DeliverReply \/ LoseReply \/ ServerFails \/ GoOffline \/ Reconnect \/ Reload
Spec == Init /\ [][Next]_vars
SavedOnlyAfterDurableAcceptance == phase = "Saved" => receipt = editor /\ server >= editor
WordsNeverLost == typed <= editor \/ typed <= journal \/ typed <= server
LocalSuccessMeansDurable == claimed <= journal
====
