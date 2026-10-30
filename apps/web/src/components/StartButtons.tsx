"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { emptyDraft } from "@/lib/answers";
import { useCheck } from "@/lib/check-store";
import { EXAMPLE_DRAFT } from "@/lib/example";

export function StartButtons() {
  const { draft, setDraft, setResults } = useCheck();
  const router = useRouter();
  const started = !draft.example && Object.keys(draft.progress).length > 0;
  const fresh = (): void => {
    setDraft(emptyDraft());
    setResults(null);
  };
  return (
    <div className="acts">
      {started ? (
        <>
          <Link className="btn pri" href="/check">
            Continue my check
          </Link>
          <Link className="btn txt" href="/check" onClick={fresh}>
            Start again
          </Link>
        </>
      ) : (
        <>
          <Link className="btn pri" href="/check" onClick={fresh}>
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
        </>
      )}
    </div>
  );
}
