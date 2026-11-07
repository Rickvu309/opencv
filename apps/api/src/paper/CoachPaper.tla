---- MODULE CoachPaper ----
EXTENDS Naturals, FiniteSets
CONSTANTS BasisCheck, RequireApproval
VARIABLES document, revision, proposal, basis, approved, commits, appliedRevision, staleDecision, undoDecision, agentDecision
vars == <<document, revision, proposal, basis, approved, commits, appliedRevision, staleDecision, undoDecision, agentDecision>>
Init ==
  /\ document = {"original"}
  /\ revision = 0
  /\ proposal = "none"
  /\ basis = 0
  /\ approved = FALSE
  /\ commits = 0
  /\ appliedRevision = 0
  /\ staleDecision = [stale |-> FALSE, approved |-> FALSE, before |-> {}, after |-> {}]
  /\ undoDecision = [tried |-> FALSE, before |-> {}, after |-> {}]
  /\ agentDecision = [tried |-> FALSE, allowed |-> FALSE, before |-> {}, after |-> {}]

Propose ==
  /\ proposal = "none"
  /\ proposal' = IF RequireApproval THEN "pending" ELSE "committed"
  /\ basis' = revision
  /\ document' = IF RequireApproval THEN document ELSE document \cup {"coach words"}
  /\ revision' = IF RequireApproval THEN revision ELSE revision + 1
  /\ commits' = IF RequireApproval THEN commits ELSE commits + 1
  /\ appliedRevision' = IF RequireApproval THEN appliedRevision ELSE revision + 1
  /\ UNCHANGED <<approved, staleDecision, undoDecision, agentDecision>>

PersonTypes ==
  /\ "person words" \notin document /\ revision < 3
  /\ document' = document \cup {"person words"}
  /\ revision' = revision + 1
  /\ UNCHANGED <<proposal, basis, approved, commits, appliedRevision, staleDecision, undoDecision, agentDecision>>

Approve ==
  /\ proposal = "pending" /\ revision < 3
  /\ proposal' = IF BasisCheck /\ basis # revision THEN "conflict" ELSE "committed"
  /\ approved' = (~BasisCheck \/ basis = revision)
  /\ commits' = IF BasisCheck /\ basis # revision THEN commits ELSE commits + 1
  /\ document' = IF BasisCheck /\ basis # revision THEN document ELSE document \cup {"coach words"}
  /\ revision' = IF BasisCheck /\ basis # revision THEN revision ELSE revision + 1
  /\ appliedRevision' = IF BasisCheck /\ basis # revision THEN appliedRevision ELSE revision + 1
  /\ staleDecision' = [stale |-> basis # revision, approved |-> (~BasisCheck \/ basis = revision), before |-> document, after |-> IF BasisCheck /\ basis # revision THEN document ELSE document \cup {"coach words"}]
  /\ UNCHANGED <<basis, undoDecision, agentDecision>>

RetryApproval ==
  /\ proposal = "committed"
  /\ UNCHANGED <<document, revision, proposal, basis, approved, commits, appliedRevision, staleDecision, undoDecision, agentDecision>>

PersonUndo ==
  /\ proposal = "committed" /\ ~undoDecision.tried
  /\ proposal' = IF revision = appliedRevision THEN "undone" ELSE "undo refused"
  /\ document' = IF revision = appliedRevision THEN document \ {"coach words"} ELSE document
  /\ undoDecision' = [tried |-> TRUE, before |-> document, after |-> IF revision = appliedRevision THEN document \ {"coach words"} ELSE document]
  /\ UNCHANGED <<revision, basis, approved, commits, appliedRevision, staleDecision, agentDecision>>

AgentTriesUndo ==
  /\ ~agentDecision.tried
  /\ agentDecision' = [tried |-> TRUE, allowed |-> FALSE, before |-> document, after |-> document]
  /\ UNCHANGED <<document, revision, proposal, basis, approved, commits, appliedRevision, staleDecision, undoDecision>>

Next == Propose \/ PersonTypes \/ Approve \/ RetryApproval \/ PersonUndo \/ AgentTriesUndo
Spec == Init /\ [][Next]_vars
DocumentUnchangedUntilApproval == (commits > 0 => approved) /\ (~approved => "coach words" \notin document)
StaleBasisRefusesWithoutWriting == staleDecision.stale => ~staleDecision.approved /\ staleDecision.before = staleDecision.after
UndoKeepsLaterTypingOrRefuses == undoDecision.tried => (undoDecision.before \ {"coach words"}) \subseteq undoDecision.after
ProposalCommitsOnce == commits <= 1
AgentHasNoUndoAction == ~agentDecision.allowed /\ (agentDecision.tried => agentDecision.before = agentDecision.after)
====
