"use client";

import * as React from "react";

import { useT } from "@/lib/i18n/use-t";

/**
 * Keeps `<html lang>` honest.
 *
 * The language lives in `localStorage`, so the server cannot know it and always
 * renders `lang="vi"`. Leaving it there would be a real accessibility bug
 * rather than a tidiness one: a screen reader picks its voice and pronunciation
 * rules from this attribute, so an English interface declared as Vietnamese is
 * read aloud with Vietnamese phonetics. Search engines and `hyphens: auto` read
 * it too.
 *
 * Writes the DOM directly in an effect rather than lifting `lang` into React
 * state: the attribute is on the element React is hydrating into, and this way
 * the server and client markup agree.
 */
export function HtmlLang() {
  const { locale } = useT();

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
