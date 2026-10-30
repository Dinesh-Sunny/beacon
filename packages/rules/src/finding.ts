// What Beacon tells the person about one kind of support. The model proposes it through a forced
// tool call; code checks the quote and sets the final verdict.

import { z } from 'zod';
import type { RulePage } from './govuk.ts';
import { verifyQuote } from './quote.ts';
import type { SchemeId } from './schemes.ts';

export const VERDICTS = ['likely', 'worth-checking', 'unlikely-right-now', 'already-get'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABEL: Record<Verdict, string> = {
  likely: 'Likely',
  'worth-checking': 'Worth checking',
  'unlikely-right-now': 'Unlikely right now',
  'already-get': 'You get this',
};

/** Shape the model fills in record_finding */
export const ProposedFindingSchema = z.object({
  scheme: z.string(),
  verdict: z.enum(['likely', 'worth-checking', 'unlikely-right-now']),
  /** One short reason in the person's terms, starting from what they told us */
  why: z.string().max(280),
  /** The exact sentence from the official page the verdict rests on */
  quote: z.string().max(600),
  /** Answers it rests on, shown as "Because you said" chips */
  becauseYouSaid: z.array(z.string().max(80)).max(4),
  /** If one answer would settle it */
  missing: z.string().max(200).optional(),
});
export type ProposedFinding = z.infer<typeof ProposedFindingSchema>;

export interface Finding extends Omit<ProposedFinding, 'scheme' | 'verdict'> {
  scheme: SchemeId;
  verdict: Verdict;
  quoteVerified: boolean;
  source: { url: string; title: string; readAt: string; publicUpdatedAt: string };
}

/** Code has the last word: no verified quote, no Likely. */
export function settleFinding(p: ProposedFinding, scheme: SchemeId, page: RulePage): Finding {
  const { verified } = verifyQuote(p.quote, page.text);
  const verdict: Verdict = p.verdict === 'likely' && !verified ? 'worth-checking' : p.verdict;
  return {
    ...p,
    scheme,
    verdict,
    quoteVerified: verified,
    source: { url: page.url, title: page.title, readAt: page.readAt, publicUpdatedAt: page.publicUpdatedAt },
  };
}

const ORDER: Record<Verdict, number> = { likely: 0, 'worth-checking': 1, 'already-get': 2, 'unlikely-right-now': 3 };
export const rankFindings = (fs: Finding[]): Finding[] => [...fs].sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
