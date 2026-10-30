"use client";

import { useActionState } from "react";
import {
  analyzeText,
  type TextStatsState,
} from "@/app/(frontend)/(site)/[site]/text-stats/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const initialState: TextStatsState = { text: "", stats: null, error: null };

export function TextStatsForm() {
  const [state, formAction, pending] = useActionState(
    analyzeText,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-xl flex-col gap-6">
      <Field data-invalid={state.error ? true : undefined}>
        <FieldLabel htmlFor="text">Text</FieldLabel>
        <Textarea
          id="text"
          name="text"
          rows={6}
          required
          defaultValue={state.text}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="text-help"
        />
        <FieldDescription id="text-help">
          Paste any text. The Python service counts words and characters.
        </FieldDescription>
        {state.error && <FieldError>{state.error}</FieldError>}
      </Field>
      <Button
        type="submit"
        disabled={pending}
        className="self-start pointer-coarse:min-h-11"
      >
        {pending && <Spinner className="motion-reduce:animate-none" />}
        {pending ? "Analyzing…" : "Analyze with Python"}
      </Button>
      <output aria-live="polite">
        {state.stats && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Words</dt>
            <dd className="font-medium tabular-nums">{state.stats.words}</dd>
            <dt className="text-muted-foreground">Characters</dt>
            <dd className="font-medium tabular-nums">
              {state.stats.characters}
            </dd>
            <dt className="text-muted-foreground">Top words</dt>
            <dd>
              {state.stats.top_words.map(([w, n]) => `${w} (${n})`).join(", ")}
            </dd>
          </dl>
        )}
      </output>
    </form>
  );
}
