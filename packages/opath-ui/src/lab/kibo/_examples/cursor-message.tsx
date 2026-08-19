"use client";

import { Cursor, CursorBody, CursorMessage, CursorPointer } from "../cursor";

const Example = () => (
  <Cursor color="#000000">
    <CursorPointer />
    <CursorBody>
      <CursorMessage>That looks great!</CursorMessage>
    </CursorBody>
  </Cursor>
);

export default Example;
