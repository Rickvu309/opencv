"use client";

import OpenInChat from "../blocks/open-in-chat";

export default function OpenInChatHorizontalDemo() {
  return (
    <OpenInChat
      prompt="Summarize this page and list the key decisions."
      layout="horizontal"
      triggerLabel="Ask AI:"
    />
  );
}
