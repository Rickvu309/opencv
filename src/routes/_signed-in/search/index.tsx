import { createFileRoute } from "@tanstack/react-router";

import { SearchView } from "./-search-view";
import { useSearchWorkspace } from "./-workspace-parts";

export const Route = createFileRoute("/_signed-in/search/")({
  component: SearchPage,
});

function SearchPage() {
  const props = useSearchWorkspace();
  return <SearchView {...props} />;
}
