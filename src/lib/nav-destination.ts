/**
 * Turn an href (and optional search object) into what TanStack Router navigates with.
 *
 * An omitted search keeps the current query, so `/paper` from `/paper?id=`
 * would stay on the opened paper. Empty object is "this URL, no query".
 * An explicit `search` wins over any query on `href`.
 */
export function destinationOf(href: string, search?: object) {
  const path = href.split("?")[0];
  if (search !== undefined) {
    return { to: path as never, search: search as never };
  }
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  return {
    to: path as never,
    search: (query
      ? Object.fromEntries(new URLSearchParams(query))
      : {}) as never,
  };
}
