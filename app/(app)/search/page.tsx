"use client";

import { SearchView } from "./search-view";
import { useSearchWorkspace } from "./workspace-parts";

export default function SearchPage() {
  const props = useSearchWorkspace();
  return <SearchView {...props} />;
}
