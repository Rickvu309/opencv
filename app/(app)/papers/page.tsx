import { redirect } from "next/navigation";

/**
 * Letters now live in My Paper. `/papers` stays as a bookmark so old links
 * and the auth gate still resolve, then land on the combined library.
 */
export default function PapersPage() {
  redirect("/cv");
}
