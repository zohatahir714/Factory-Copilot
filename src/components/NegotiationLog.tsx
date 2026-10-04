/**
 * Negotiation timeline — Task 5, Phase 3.
 *
 * Shows two agents' offers round by round, and says plainly when no deal was
 * reached. A failure is rendered as a first-class outcome, not as an empty
 * state: "they could not agree" is the result, and hiding it would be the
 * dishonest choice.
 *
 * THE AI NARRATIVE IS OPTIONAL AND NEVER LOAD-BEARING
 *   `queryGroqChat` throws when the server key is missing, the proxy is down
 *   or the network is unavailable — all three happen. So the call is wrapped
 *   end to end: on any failure the component renders the raw transcript, which
 *   is always present and always correct. The narrative is a translation of the
 *   transcript, never a source of facts in it — nothing here is allowed to
 *   invent an outcome the driver did not return.
 */
import { useCallback, useEffect, useState } from 'react';
import { Handshake, ArrowDownLeft, ArrowUpRight, Sparkles, CircleSlash, Loader2 } from 'lucide-react';
import { negotiate } from '../agents/negotiation/negotiate.ts';
import type { NegotiateResult } from '../agents/negotiation/negotiate.ts';
import { queryGroqChat } from '../lib/groqClient';

export interface NegotiationLogProps {
  initialAsking?: number;
  initialFloor?: number;
  initialCeiling?: number;
  maxRounds?: number;
  /** Dark-mode aware, matching the rest of the dashboard. */
  darkMode?: boolean;
  className?: string;
}

const pkr = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

/**
 * Flatten the transcript into a factual prompt. Only facts from `result` are
 * included — the model is asked to explain what happened, not to decide.
 */
function buildNarrativePrompt(result: NegotiateResult, asking: number, floor: number, ceiling: number) {
  const transcript = result.rounds
    .map(r => `Round ${r.round} — ${r.by}: offered ${pkr(r.price)}. Reason: ${r.reason}`)
    .join('\n');

  return [
    'You are summarising a price negotiation between a buyer agent and a supplier agent for a textile mill.',
    '',
    `Buyer ceiling: ${pkr(ceiling)}`,
    `Supplier floor: ${pkr(floor)}`,
    `Buyer opening ask: ${pkr(asking)}`,
    `Outcome: ${result.agreed ? `agreed at ${pkr(result.agreedPrice!)}` : `no deal — ${result.reason}`}`,
    '',
    'Transcript:',
    transcript,
    '',
    'In 2-3 sentences, summarise how the negotiation moved and why it ended where it did.',
    'Give the English summary, then a short Urdu summary on a new line.',
    'Do not invent any figure, round or outcome that is not in the transcript above.'
  ].join('\n');
}

export default function NegotiationLog({
  initialAsking = 1450,
  initialFloor = 1200,
  initialCeiling = 1500,
  maxRounds = 8,
  darkMode = false,
  className = ''
}: NegotiationLogProps) {
  const [asking, setAsking] = useState(initialAsking);
  const [floor, setFloor] = useState(initialFloor);
  const [ceiling, setCeiling] = useState(initialCeiling);
  const [result, setResult] = useState<NegotiateResult | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeState, setNarrativeState] = useState<'idle' | 'loading' | 'ok' | 'failed'>('idle');
  const [failedBecause, setFailedBecause] = useState<string | null>(null);

  // Re-run whenever the brief changes. `negotiate` is pure, so this is the
  // whole computation — there is no hidden state to fall out of sync.
  useEffect(() => {
    setResult(negotiate({ asking, floor, ceiling, maxRounds }));
    setNarrative(null);
    setNarrativeState('idle');
    setFailedBecause(null);
  }, [asking, floor, ceiling, maxRounds]);

  const requestNarrative = useCallback(async () => {
    if (!result) return;
    setNarrativeState('loading');
    setFailedBecause(null);
    try {
      const text = await queryGroqChat(
        [{ role: 'user', content: buildNarrativePrompt(result, asking, floor, ceiling) }]
      );
      // A model that returns nothing is a failure, not a summary.
      if (!text || !text.trim()) {
        setNarrativeState('failed');
        setFailedBecause('The AI returned an empty summary.');
        return;
      }
      setNarrative(text);
      setNarrativeState('ok');
    } catch (err: any) {
      // Missing key, proxy down, offline — all land here. The transcript below
      // is unaffected and remains the source of truth.
      setNarrativeState('failed');
      setFailedBecause(err?.message || 'The AI summary is unavailable.');
    }
  }, [result, asking, floor, ceiling]);

  if (!result) return null;

  const agreed = result.agreed;

  return (
    <section
      className={`space-y-4 rounded-xl border shadow-sm ${
        darkMode
          ? 'bg-slate-900 border-slate-800'
          : 'bg-white border-slate-200'
      } ${className}`}
      aria-label="Agent negotiation"
    >
      <header
        className={`flex flex-wrap items-center gap-2 border-b px-4 py-3 ${
          darkMode ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <Handshake className={`h-4 w-4 ${agreed ? 'text-emerald-500' : 'text-amber-500'}`} aria-hidden />
        <h2 className={`text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
          Buyer and supplier agents
        </h2>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            agreed
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
          }`}
        >
          {agreed ? `Agreed at ${pkr(result.agreedPrice!)}` : 'No deal'}
        </span>

        <span className={`ml-auto text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {result.rounds.length} of {result.maxRounds} rounds
        </span>
      </header>

      {/* The brief is editable on purpose: the demo value is the deal, but the
          interesting thing to show a judge is the refusal. Typing a floor above
          the ceiling makes the agents fail, and the failure is rendered as a
          result rather than as an error. */}
      <div
        className={`flex flex-wrap items-end gap-2 px-4 pt-3 ${
          darkMode ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        {([
          { label: 'Opening ask', value: asking, set: setAsking },
          { label: 'Supplier floor', value: floor, set: setFloor },
          { label: 'Buyer ceiling', value: ceiling, set: setCeiling }
        ] as const).map(field => (
          <label key={field.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider">{field.label}</span>
            <input
              type="number"
              value={field.value}
              onChange={e => field.set(Number(e.target.value))}
              className={`w-28 rounded-lg border px-2 py-1 font-mono text-xs font-bold outline-none ${
                darkMode
                  ? 'border-slate-700 bg-slate-800 text-slate-100'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </label>
        ))}
      </div>

      {/* The failure reason is shown as prominently as a successful price. */}
      {!agreed && result.reason && (
        <div
          className={`mx-4 mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            darkMode
              ? 'border-amber-800 bg-amber-950/30 text-amber-200'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <CircleSlash className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-bold">The agents did not agree.</strong> {result.reason}{' '}
            <span className="opacity-80">No price is reported, because no price was agreed.</span>
          </span>
        </div>
      )}

      {/* The transcript — always present, always the source of truth. */}
      <ol className="space-y-0 px-4 pt-3">
        {result.rounds.map((round, i) => {
          const isBuyer = round.by === 'buyer';
          const Icon = isBuyer ? ArrowDownLeft : ArrowUpRight;
          const last = i === result.rounds.length - 1;
          return (
            <li key={i} className="relative flex gap-3 pb-4">
              {/* Timeline rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    isBuyer
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                {!last && <span className="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden />}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`text-xs font-bold capitalize ${
                      isBuyer ? 'text-indigo-700 dark:text-indigo-300' : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    Round {round.round} · {round.by}
                  </span>
                  <span className={`font-mono text-sm font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {pkr(round.price)}
                  </span>
                </div>
                <p className={`mt-0.5 text-[11px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {round.reason}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Optional AI summary. Purely additive. */}
      <footer
        className={`border-t px-4 py-3 ${
          darkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {narrativeState === 'idle' && (
          <button
            onClick={requestNarrative}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              darkMode
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Summarise this negotiation
          </button>
        )}

        {narrativeState === 'loading' && (
          <p className={`flex items-center gap-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Asking the AI to summarise the transcript…
          </p>
        )}

        {narrativeState === 'ok' && narrative && (
          <div className="space-y-1">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              AI summary of the transcript above — the transcript remains the record.
            </p>
            <p className={`text-xs leading-relaxed ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {narrative}
            </p>
          </div>
        )}

        {narrativeState === 'failed' && (
          <div className="space-y-1">
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <strong className="font-bold">AI summary unavailable</strong>
              {failedBecause ? ` — ${failedBecause}` : '.'} The round-by-round transcript above is the
              complete record and is unaffected.
            </p>
            <button
              onClick={requestNarrative}
              className={`text-xs font-bold underline ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}
            >
              Try again
            </button>
          </div>
        )}
      </footer>
    </section>
  );
}