import Link from "next/link";
import { PageHeading } from "@/components/admin/Shell";
import { requireRecruiter } from "@/lib/auth";
import { OpeningForm } from "../OpeningForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "New opening" };

export default async function NewOpeningPage() {
  await requireRecruiter();

  return (
    <>
      <Link
        href="/portal/openings"
        className="mb-6 inline-block text-sm text-muted underline-offset-4 hover:text-navy hover:underline"
      >
        ← All openings
      </Link>

      <PageHeading
        title="New job opening"
        description="Published openings appear to every registered student who meets the eligibility filters. Only the description below is shown to them."
      />

      <OpeningForm />
    </>
  );
}
