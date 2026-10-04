/**
 * Teaching — the panel that stops anyone having to file a ticket for a new
 * phrasing.
 *
 * Every sentence the copilot could not place is recorded. This panel lists
 * them, and one click binds each to a real capability. From that moment the
 * exact phrase works, offline, on this machine, with no deploy and no commit.
 *
 * That is the whole point. Extending the command surface stops being a code
 * change and becomes a thing the user does.
 *
 * Deliberately honest about its own limits: the phrase is matched EXACTLY, so
 * teaching "customer save karo" does not silently teach every sentence with
 * those words in it. If the user wants a family of phrasings, that is a
 * capability change, not a teaching change, and the panel says so.
 */
import React, { useState, useEffect } from 'react';
import { GraduationCap, Trash2, Plus, X } from 'lucide-react';
import {
  learnedPhrases,
  learnPhrase,
  forgetPhrase,
  clearLearnedPhrases,
  recentMisses,
  recordMiss,
  forgetMiss,
  clearMisses,
  type LearnedPhrase
} from '../lib/ai/misses.ts';
import { TOOL_SPECS, type ToolName } from '../lib/ai/contract.ts';

const READ_TOOLS = TOOL_SPECS.filter(t => !t.writes);
const ALL_TOOLS = TOOL_SPECS;

export function TeachingPanel() {
  const [misses, setMisses] = useState<string[]>([]);
  const [learned, setLearned] = useState<LearnedPhrase[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolName>('check_stock');

  useEffect(() => {
    setMisses(recentMisses());
    setLearned(learnedPhrases());
  }, []);

  const teach = (phrase: string) => {
    learnPhrase(phrase, tool);
    setLearned(learnedPhrases());
    setMisses(forgetMiss(phrase));
    setOpen(null);
  };

  return (
    <div className="surface-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <GraduationCap className="w-4 h-4 text-indigo-500" aria-hidden />
        <h3 className="text-base font-bold text-slate-900">Teaching</h3>
        <span className="text-xs text-slate-500">
          {misses.length} phrase{misses.length === 1 ? '' : 's'} I could not place
        </span>
        {misses.length > 0 && (
          <button
            onClick={() => { clearMisses(); setMisses([]); }}
            className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            Clear list
          </button>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Anything the copilot cannot place is listed here. Bind a phrase to a capability and it
        works from that moment — no build, no deploy. Phrases are matched exactly, so teaching
        one sentence does not teach every sentence that contains its words.
      </p>

      {misses.length === 0 && learned.length === 0 && (
        <p className="mt-4 text-xs text-slate-500">
          Nothing to teach. When you retype a command I do not understand, it appears here.
        </p>
      )}

      {misses.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {misses.map(m => (
            <li key={m} className="px-3 py-2 flex flex-wrap items-center gap-2">
              <code className="font-mono text-xs text-slate-800 flex-1 min-w-[12rem] truncate">
                {m}
              </code>
              {open === m ? (
                <span className="flex items-center gap-1.5">
                  <select
                    value={tool}
                    onChange={e => setTool(e.target.value as ToolName)}
                    className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white"
                  >
                    {ALL_TOOLS.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => teach(m)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    <Plus className="w-3 h-3" aria-hidden /> Teach
                  </button>
                  <button
                    onClick={() => { setMisses(forgetMiss(m)); setOpen(null); }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" aria-hidden /> Ignore
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setOpen(m)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Teach this
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {learned.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Taught ({learned.length})
          </h4>
          <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {learned.map(p => (
              <li key={p.phrase} className="px-3 py-2 flex items-center gap-2">
                <code className="font-mono text-xs text-slate-800 flex-1 min-w-[12rem] truncate">
                  {p.phrase}
                </code>
                <span className="text-[11px] text-slate-500">{p.tool}</span>
                <button
                  onClick={() => { forgetPhrase(p.phrase); setLearned(learnedPhrases()); }}
                  className="text-slate-400 hover:text-rose-600"
                  title="Forget this phrase"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => { clearLearnedPhrases(); setLearned([]); }}
            className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            Forget all ({learned.length})
          </button>
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-500">
        {READ_TOOLS.length} read and {ALL_TOOLS.length - READ_TOOLS.length} write capabilities
        available to bind. Every write still opens a confirmation card — teaching changes which
        tool runs, never what it is allowed to do.
      </p>
    </div>
  );
}

export default TeachingPanel;