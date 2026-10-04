/**
 * Human approval gate for autonomous agent proposals.
 *
 * This is the visible half of the rule that nothing reaches the ledger without
 * an explicit human decision. The runtime proposes; this component is the only
 * place a proposal becomes a transaction.
 *
 * Rendered inline on the dashboard rather than behind a tab, so a proposal is
 * visible the moment it appears — the demo point is that nobody had to go
 * looking for it.
 */
import { Bot, Check, X, ShieldAlert, ScrollText, ChevronRight } from 'lucide-react';
import type { AgentProposal, AuditEntry } from '../agents/types';

interface Props {
  proposals: AgentProposal[];
  audit: AuditEntry[];
  onApprove: (proposal: AgentProposal) => void;
  onReject: (proposal: AgentProposal) => void;
  busyId?: string | null;
}

function confidenceTone(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
  if (confidence >= 0.6) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

const TOOL_LABEL: Record<AgentProposal['tool'], string> = {
  create_purchase_order: 'Purchase Order',
  record_sale: 'Sales Invoice',
  record_expense: 'Expense',
  flag_anomaly: 'Anomaly'
};

export default function AgentApprovalQueue({
  proposals, audit, onApprove, onReject, busyId
}: Props) {
  const pending = proposals.filter(p => p.status === 'proposed');
  if (pending.length === 0 && audit.length === 0) return null;

  return (
    <section className="mb-6 space-y-4" aria-label="Agent activity">
      {/* COLLAPSED BY DEFAULT.
          This block used to be open on every dashboard load, which put a
          four-line anomaly card above the revenue tile for the whole session —
          and read as system noise rather than as the feature it is. It now
          opens as one line that states the count, says plainly that nothing is
          written until a person approves, and expands on click. The autonomous
          proposal still raises itself unprompted; it just no longer interrupts
          the numbers. */}
      {pending.length > 0 && (
        <details className="group rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 shadow-sm">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3">
            <Bot className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {pending.length} agent {pending.length === 1 ? 'proposal' : 'proposals'} awaiting your approval
            </span>
            <span className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:inline">
              Nothing is written until you approve
            </span>
            <ChevronRight
              className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
              aria-hidden
            />
          </summary>

          <ul className="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:divide-slate-800 dark:border-slate-800">
            {pending.map(p => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {p.title}
                  </span>
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {TOOL_LABEL[p.tool]}
                  </span>
                  <span className={`ml-auto text-xs font-bold ${confidenceTone(p.confidence)}`}>
                    {Math.round(p.confidence * 100)}% confidence
                  </span>
                </div>

                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {p.rationale}
                </p>

                <ul className="mt-1.5 space-y-0.5">
                  {p.citations.map((c, i) => (
                    <li key={i} className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-500">
                      <ShieldAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onApprove(p)}
                    disabled={busyId === p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {busyId === p.id ? 'Applying…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => onReject(p)}
                    disabled={busyId === p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {audit.length > 0 && (
        <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ScrollText className="h-3.5 w-3.5" aria-hidden />
            Agent audit trail
            <span className="ml-auto font-normal text-slate-400">{audit.length} entries</span>
          </summary>
          <table className="w-full text-left text-[11px]">
            <thead className="border-y border-slate-200 dark:border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-1.5 font-semibold">Time</th>
                <th className="px-2 py-1.5 font-semibold">Agent</th>
                <th className="px-2 py-1.5 font-semibold">Action</th>
                <th className="px-2 py-1.5 text-right font-semibold">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {audit.slice(0, 50).map(a => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-1.5 text-slate-400">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-slate-700 dark:text-slate-300">{a.agentId}</td>
                  <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">
                    {a.action}
                    {a.citations.length > 0 && (
                      <span className="block text-slate-400">{a.citations[0]}</span>
                    )}
                  </td>
                  <td className={`px-2 py-1.5 text-right font-bold ${confidenceTone(a.confidence)}`}>
                    {Math.round(a.confidence * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}