# Implementation Plan: WO-50

**Work Order:** WO-50 - Build the application tracker UI

## Approach

`app/(app)/applications/page.tsx`. One card per application: the job, the stage
buttons, the next step, a deadline, notes, and the tailoring controls.

Ordered by deadline rather than by when it was added, because the question
somebody opens this screen with is "what needs me today". Closed applications
sink below the live ones whatever their date.

The stage buttons offer only the moves `canTransition` allows, so the interface
cannot suggest a transition the reducer would silently drop. `rejected` sits
after a divider rather than in the row, because it is not the fifth stage.

The next step is shown rather than hidden behind a click: somebody who opened
this screen has already decided to do something today. Beside it is a control
that hands the Coach the job, the company and the stage, which is the version
that knows the person (AC-APP-007.2).
