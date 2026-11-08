---- MODULE PaperLocal ----
EXTENDS Naturals
CONSTANTS MaxEdits, JournalOnInput, ResolveOnCommit, ClearOnlyAfterBoth, SavedAfterDurability
VARIABLES typed, editor, journal, local, requestValue, claimed, server, receipt, flight, phase, online, life, exits, normalThrough, durableThrough, cleared, aborted
vars == <<typed, editor, journal, local, requestValue, claimed, server, receipt, flight, phase, online, life, exits, normalThrough, durableThrough, cleared, aborted>>
Max2(a, b) == IF a >= b THEN a ELSE b
Max3(a, b, c) == Max2(Max2(a, b), c)
CanShowSaved(value, committed, acknowledged) ==
  acknowledged >= value /\ (~SavedAfterDurability \/ committed >= value)
Init ==
  /\ typed = 0
  /\ editor = 0
  /\ journal = 0
  /\ local = 0
  /\ requestValue = 0
  /\ claimed = 0
  /\ server = 0
  /\ receipt = 0
  /\ flight = 0
  /\ phase = "Saved"
  /\ online = TRUE
  /\ life = "Open"
  /\ exits = 0
  /\ normalThrough = 0
  /\ durableThrough = 0
  /\ cleared = 0
  /\ aborted = FALSE

Type ==
  /\ life = "Open" /\ typed < MaxEdits /\ editor = typed
  /\ typed' = typed + 1
  /\ editor' = typed + 1
  /\ journal' = IF JournalOnInput THEN typed + 1 ELSE journal
  /\ phase' = "Saving"
  /\ UNCHANGED <<local, requestValue, claimed, server, receipt, flight, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

LocalRequestSuccess ==
  /\ life = "Open" /\ requestValue = 0 /\ editor > local
  /\ requestValue' = editor
  /\ claimed' = IF ResolveOnCommit THEN claimed ELSE Max2(claimed, editor)
  /\ UNCHANGED <<typed, editor, journal, local, server, receipt, flight, phase, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

DurabilityPointD ==
  /\ life = "Open" /\ requestValue > 0
  /\ local' = Max2(local, requestValue)
  /\ durableThrough' = Max2(durableThrough, requestValue)
  /\ claimed' = Max2(claimed, requestValue)
  /\ requestValue' = 0
  /\ phase' = IF CanShowSaved(editor, Max2(local, requestValue), receipt) THEN "Saved" ELSE "Saving"
  /\ UNCHANGED <<typed, editor, journal, server, receipt, flight, online, life, exits, normalThrough, cleared, aborted>>

LocalAbort ==
  /\ life = "Open" /\ requestValue > 0 /\ ~aborted
  /\ requestValue' = 0
  /\ aborted' = TRUE
  /\ UNCHANGED <<typed, editor, journal, local, claimed, server, receipt, flight, phase, online, life, exits, normalThrough, durableThrough, cleared>>

SendOrRetry ==
  /\ life = "Open" /\ online /\ editor > receipt /\ flight = 0
  /\ flight' = editor
  /\ phase' = "Saving"
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, server, receipt, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

AcceptDurably ==
  /\ flight > server
  /\ server' = flight
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, receipt, flight, phase, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

DeliverReply ==
  /\ life = "Open" /\ online /\ flight > 0 /\ server >= flight
  /\ receipt' = Max2(receipt, flight)
  /\ flight' = 0
  /\ phase' = IF CanShowSaved(editor, local, Max2(receipt, flight)) THEN "Saved" ELSE "Saving"
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, server, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

LoseReply ==
  /\ life = "Open" /\ flight > 0 /\ server >= flight
  /\ flight' = 0
  /\ phase' = "Saving"
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, server, receipt, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

ServerFails ==
  /\ life = "Open" /\ flight > server
  /\ flight' = 0
  /\ phase' = "Saving"
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, server, receipt, online, life, exits, normalThrough, durableThrough, cleared, aborted>>

ClearJournal ==
  /\ life = "Open" /\ journal > 0
  /\ IF ClearOnlyAfterBoth THEN journal <= local /\ journal <= receipt
     ELSE journal <= local \/ journal <= receipt
  /\ cleared' = Max2(cleared, journal)
  /\ journal' = 0
  /\ UNCHANGED <<typed, editor, local, requestValue, claimed, server, receipt, flight, phase, online, life, exits, normalThrough, durableThrough, aborted>>

GoOffline ==
  /\ life = "Open" /\ online
  /\ online' = FALSE
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, server, receipt, flight, phase, life, exits, normalThrough, durableThrough, cleared, aborted>>

Reconnect ==
  /\ life = "Open" /\ ~online
  /\ online' = TRUE
  /\ UNCHANGED <<typed, editor, journal, local, requestValue, claimed, server, receipt, flight, phase, life, exits, normalThrough, durableThrough, cleared, aborted>>

PagehideFlush ==
  /\ life = "Open" /\ typed > 0 /\ exits = 0
  /\ normalThrough' = editor
  /\ editor' = 0
  /\ requestValue' = 0
  /\ flight' = 0
  /\ phase' = "Closed"
  /\ life' = "Closed"
  /\ exits' = 1
  /\ UNCHANGED <<typed, journal, local, claimed, server, receipt, online, durableThrough, cleared, aborted>>

AbruptKill ==
  /\ life = "Open" /\ typed > 0 /\ exits = 0
  /\ editor' = 0
  /\ journal' = 0
  /\ requestValue' = 0
  /\ flight' = 0
  /\ phase' = "Killed"
  /\ life' = "Killed"
  /\ exits' = 1
  /\ UNCHANGED <<typed, local, claimed, server, receipt, online, normalThrough, durableThrough, cleared, aborted>>

Recover ==
  /\ life \in {"Closed", "Killed"}
  /\ editor' = Max3(local, journal, IF online THEN server ELSE 0)
  /\ life' = "Open"
  /\ phase' = "Saving"
  /\ UNCHANGED <<typed, journal, local, requestValue, claimed, server, receipt, flight, online, exits, normalThrough, durableThrough, cleared, aborted>>

Next == Type \/ LocalRequestSuccess \/ DurabilityPointD \/ LocalAbort
  \/ SendOrRetry \/ AcceptDurably \/ DeliverReply \/ LoseReply \/ ServerFails
  \/ ClearJournal \/ GoOffline \/ Reconnect \/ PagehideFlush \/ AbruptKill \/ Recover
Spec == Init /\ [][Next]_vars
Bound == typed <= MaxEdits /\ exits <= 1
ChartSteps == online' /\ ~aborted'
SavedOnlyAfterDurableAcceptance == phase = "Saved" =>
  receipt >= editor /\ server >= editor /\ local >= editor /\ durableThrough >= editor
WordsBeforeDSurviveKill ==
  IF life = "Open" THEN editor >= durableThrough
  ELSE Max2(local, server) >= durableThrough
NormalCloseOrReloadLosesNothing ==
  IF life = "Open" THEN editor >= normalThrough
  ELSE Max3(journal, local, server) >= normalThrough
LocalSuccessMeansDurable == claimed <= local
JournalClearedOnlyAfterBoth == cleared <= local /\ cleared <= receipt
SavingUntilD == life = "Open" /\ editor > durableThrough => phase = "Saving"
====
