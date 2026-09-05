import { redirect } from "next/navigation";

/**
 * The portal's one surface is job openings — candidate bundles were removed
 * (2026-08-24, owner decision): recruiters see exactly the students who
 * applied to them, nothing curated. The index just forwards.
 */
export default function PortalIndexPage() {
  redirect("/portal/openings");
}
