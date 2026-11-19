import {
  APPROVE_THE_EDIT,
  ASK_FOR_AN_EDIT,
  COMPOSER,
  DENY_THE_WAITING_EDIT,
  OPEN_BLANK_CV,
  OPEN_PANEL,
  PANEL,
  PANEL_APPROVE,
  PANEL_DENIED,
  PANEL_DENY,
  PANEL_EXPAND,
  PANEL_UNDO,
  PANEL_UNDONE,
  REOPEN_LATEST_CHAT,
  UNDO_THE_EDIT,
} from "./screen-steps.mjs"

export const COACH_SCREENS = [
  {
    id: "coach-home",
    route: "/coach",
    steps: [{ waitFor: { selector: COMPOSER } }],
  },
  {
    id: "coach-home-focused",
    route: "/coach",
    steps: [
      { click: { selector: COMPOSER } },
      { fill: { selector: COMPOSER, text: "Help me prep for Friday" } },
    ],
  },
  {
    id: "coach-home-recent",
    route: "/coach",
    steps: [
      { fill: { selector: COMPOSER, text: "What should I do next?" } },
      { press: "Enter" },
      { waitFor: { text: "Prep the starred" } },
      {
        click: {
          selector: '[data-surface="coach"] button[aria-label="New chat"]',
        },
      },
      { waitFor: { selector: '[data-slot="coach-recent-chats"]' } },
    ],
  },
  {
    id: "coach-chat-finished",
    route: "/coach",
    steps: [
      { fill: { selector: COMPOSER, text: "What should I do next?" } },
      { press: "Enter" },
      { waitFor: { text: "Prep the starred" } },
    ],
  },
  {
    id: "paper-panel-open",
    route: "/paper",
    steps: [...OPEN_BLANK_CV, ...OPEN_PANEL],
  },
  {
    id: "coach-chat-streaming",
    route: "/coach",
    unreachable:
      "The fake Coach replays its script with no delay, so the turn finishes before a frame can be captured; it needs a paced fake script",
  },
  {
    id: "paper-panel-closed",
    route: "/paper",
    steps: [...OPEN_BLANK_CV, { waitFor: { selector: "[data-dock-coach]" } }],
  },
  {
    id: "paper-panel-approval",
    route: "/paper",
    steps: ASK_FOR_AN_EDIT,
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "paper-panel-receipt",
    route: "/paper",
    steps: APPROVE_THE_EDIT,
  },
  {
    id: "paper-panel-undone",
    route: "/paper",
    steps: UNDO_THE_EDIT,
  },
  {
    id: "coach-approval",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      { clickIfShown: { selector: PANEL_EXPAND } },
      { waitFor: { selector: PANEL_DENY } },
    ],
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "coach-approval-draft",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      { clickIfShown: { selector: PANEL_EXPAND } },
      {
        fill: {
          selector: `${PANEL} ${COMPOSER}`,
          text: "Why this wording?",
        },
      },
      { waitFor: { selector: PANEL_DENY } },
    ],
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "coach-receipt",
    route: "/paper",
    steps: [
      ...APPROVE_THE_EDIT,
      { clickIfShown: { selector: PANEL_EXPAND } },
      { waitFor: { selector: PANEL_UNDO } },
    ],
  },
  {
    id: "coach-undone",
    route: "/paper",
    steps: [
      ...UNDO_THE_EDIT,
      { clickIfShown: { selector: PANEL_EXPAND } },
      { waitFor: { selector: PANEL_UNDONE } },
    ],
  },
  {
    id: "coach-denied",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      { clickIfShown: { selector: PANEL_EXPAND } },
      { waitFor: { selector: PANEL_DENY } },
      ...DENY_THE_WAITING_EDIT,
    ],
  },
  {
    id: "paper-proposal-card",
    route: "/paper",
    steps: [
      ...OPEN_BLANK_CV,
      ...OPEN_PANEL,
      {
        fill: {
          selector: `${PANEL} ${COMPOSER}`,
          text: "Please improve the summary",
        },
      },
      { press: "Enter" },
      { waitFor: { selector: PANEL_APPROVE } },
      { waitFor: { selector: 'section[aria-label="Coach proposal"]' } },
    ],
    after: DENY_THE_WAITING_EDIT,
  },
  {
    id: "coach-denied-reloaded",
    route: "/paper",
    steps: [
      ...ASK_FOR_AN_EDIT,
      ...DENY_THE_WAITING_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { selector: PANEL_DENIED } },
    ],
  },
  {
    id: "coach-receipt-reloaded",
    route: "/paper",
    steps: [
      ...APPROVE_THE_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { selector: PANEL_UNDO } },
    ],
  },
  {
    id: "coach-undone-reloaded",
    route: "/paper",
    steps: [
      ...UNDO_THE_EDIT,
      ...REOPEN_LATEST_CHAT,
      { waitFor: { selector: PANEL_UNDONE } },
    ],
  },
  {
    id: "coach-stopped-reloaded",
    route: "/paper",
    unreachable:
      "Stop is hidden while an approval waits. The stopped message asks the person to ask Coach again and is stored only when that waiting approval is cancelled. Stopping while the turn streams ends the turn before a proposal exists, and that stop is not written into the reopened chat.",
  },
  {
    id: "coach-expired-reloaded",
    route: "/paper",
    unreachable:
      "An approval reads as Expired only after it waits 24 hours unanswered, and the scripted runtime has no clock to move past that wait",
  },
  {
    id: "coach-unreadable-step",
    route: "/paper",
    unreachable:
      "A saved step reads as This step could not be read only when its stored part fails the part schema, and every writer checks the schema first, so it needs a direct edit of chat_messages.parts in the database",
  },
]
