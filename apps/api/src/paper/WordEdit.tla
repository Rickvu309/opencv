---- MODULE WordEdit ----
EXTENDS Integers

CONSTANTS ApprovalGate, BasisCheck, CasCheck, ReceiptInTx, UndoCheck, MaxTyping

None == -1

VARIABLES head, next, status, basedOn, forward, tx, landed, receipt,
          landedOn, undone, undoFrom, undoTo, typed

vars == <<head, next, status, basedOn, forward, tx, landed, receipt,
          landedOn, undone, undoFrom, undoTo, typed>>

Init ==
  /\ head = 0
  /\ next = 1
  /\ status = "none"
  /\ basedOn = None
  /\ forward = None
  /\ tx = "idle"
  /\ landed = FALSE
  /\ receipt = FALSE
  /\ landedOn = None
  /\ undone = FALSE
  /\ undoFrom = None
  /\ undoTo = None
  /\ typed = 0

Propose ==
  /\ status = "none"
  /\ tx = "idle"
  /\ basedOn' = head
  /\ forward' = next
  /\ next' = next + 1
  /\ IF ApprovalGate
     THEN /\ status' = "pending"
          /\ UNCHANGED <<head, landed, receipt, landedOn>>
     ELSE /\ status' = "pending"
          /\ head' = next
          /\ landed' = TRUE
          /\ receipt' = TRUE
          /\ landedOn' = head
  /\ UNCHANGED <<tx, undone, undoFrom, undoTo, typed>>

PersonTypes ==
  /\ tx = "idle"
  /\ typed < MaxTyping
  /\ head' = next
  /\ next' = next + 1
  /\ typed' = typed + 1
  /\ UNCHANGED <<status, basedOn, forward, tx, landed, receipt,
                 landedOn, undone, undoFrom, undoTo>>

ApproveBegin ==
  /\ status = "pending"
  /\ tx = "idle"
  /\ IF BasisCheck /\ head # basedOn
     THEN UNCHANGED vars
     ELSE /\ tx' = "locked"
          /\ UNCHANGED <<head, next, status, basedOn, forward, landed, receipt,
                         landedOn, undone, undoFrom, undoTo, typed>>

WriteHead ==
  /\ tx = "locked"
  /\ IF CasCheck /\ head # basedOn
     THEN /\ tx' = "idle"
          /\ UNCHANGED <<head, next, status, basedOn, forward, landed, receipt,
                         landedOn, undone, undoFrom, undoTo, typed>>
     ELSE /\ tx' = "headWritten"
          /\ landedOn' = head
          /\ IF ReceiptInTx
             THEN UNCHANGED <<head, landed>>
             ELSE /\ head' = forward
                  /\ landed' = TRUE
          /\ UNCHANGED <<next, status, basedOn, forward, receipt,
                         undone, undoFrom, undoTo, typed>>

WriteReceipt ==
  /\ tx = "headWritten"
  /\ head' = forward
  /\ landed' = TRUE
  /\ receipt' = TRUE
  /\ status' = "approved"
  /\ tx' = "idle"
  /\ UNCHANGED <<next, basedOn, forward, landedOn, undone, undoFrom, undoTo, typed>>

Crash ==
  /\ tx \in {"locked", "headWritten"}
  /\ tx' = "idle"
  /\ landedOn' = IF landed THEN landedOn ELSE None
  /\ UNCHANGED <<head, next, status, basedOn, forward, landed, receipt,
                 undone, undoFrom, undoTo, typed>>

RetryApproval ==
  /\ status = "approved"
  /\ tx = "idle"
  /\ UNCHANGED vars

Undo ==
  /\ status = "approved"
  /\ receipt
  /\ ~undone
  /\ tx = "idle"
  /\ IF UndoCheck /\ head # forward
     THEN UNCHANGED vars
     ELSE /\ head' = basedOn
          /\ undone' = TRUE
          /\ undoFrom' = head
          /\ undoTo' = basedOn
          /\ UNCHANGED <<next, status, basedOn, forward, tx, landed, receipt,
                         landedOn, typed>>

Next ==
  \/ Propose
  \/ PersonTypes
  \/ ApproveBegin
  \/ WriteHead
  \/ WriteReceipt
  \/ Crash
  \/ RetryApproval
  \/ Undo

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ head \in 0..(MaxTyping + 1)
  /\ status \in {"none", "pending", "approved"}
  /\ tx \in {"idle", "locked", "headWritten"}
  /\ typed \in 0..MaxTyping

ChangesOnlyAfterApproval ==
  (head = forward /\ ~undone) => status = "approved" /\ receipt

StaleNeverLands ==
  landed => landedOn = basedOn

BothOrNeither ==
  tx = "idle" => (landed = receipt)

UndoRestoresPriorHead ==
  undone => (undoFrom = forward /\ undoTo = basedOn /\ landedOn = basedOn)

====
