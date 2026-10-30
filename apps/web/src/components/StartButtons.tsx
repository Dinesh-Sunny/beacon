"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { emptyDraft } from "@/lib/answers";
import { useCheck } from "@/lib/check-store";
import { EXAMPLE_DRAFT } from "@/lib/example";

export function StartButtons() {
  const { setDraft, setResults } = useCheck();
  const router = useRouter();
  return (
    <div className="acts">
      <Link
        className="btn pri"
        href="/check"
        onClick={() => {
          setDraft(emptyDraft());
          setResults(null);
        }}
      >
        Start my check
      </Link>
      <button
        type="button"
        className="btn txt"
        onClick={() => {
          setDraft(EXAMPLE_DRAFT);
          setResults(null);
          router.push("/check#example");
        }}
      >
        Try an example
      </button>
    </div>
  );
}
