# Control

How anything changes in OpenCV, and how the person stays in charge.

## Language

**Command**:
A named change a person or an agent can ask for, such as renaming a Paper.
_Avoid_: action, mutation, tool

**Read**:
A named question that changes nothing.
_Avoid_: query

**Actor**:
Who is asking: the Person, the Coach, a Delegate or a Visitor.

**Visitor**:
Someone who is not signed in and reads what a person chose to share.
_Avoid_: public, anonymous, stranger

**Proposal**:
A command an agent wants to run that waits for the person. It ends approved, denied or expired.
_Avoid_: pending action, suggestion, confirmation

**Approval**:
The person's yes to a proposal. A denial is the person's no.
_Avoid_: confirm, accept

**Approval policy**:
The rule on a command that says whether an agent may run it alone, must propose it, or may never run it.

**Receipt**:
The record of one command that ran: who, what and when.
_Avoid_: activity row, log entry

**Activity**:
The person's list of receipts.

**Undo**:
Reversing one receipt.
_Avoid_: revert, reversal
