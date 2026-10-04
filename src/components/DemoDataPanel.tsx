import React from 'react';
import { Sparkles, FlaskConical, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Demo ledger controls.
 *
 * These used to sit on the Executive Dashboard, inside `FirstRunGuide`. That was
 * the wrong home twice over: "Reset & Seed" *wipes the cloud ledger*, which is
 * an administrative action that should never be one misclick away from the
 * numbers a judge is looking at, and neither action belongs in a first-run
 * onboarding checklist.
 *
 * They now live under Settings → Supabase & Cloud DB, next to backup and
 * restore, which is where the other ledger-wide operations already are.
 *
 * The actions themselves are unchanged — `resetAndSeedDemo` and
 * `loadDemoFactory` still come straight from AppContext, so behaviour and the
 * approval trail are identical. Only the location moved.
 */
export const DemoDataPanel: React.FC = () => {
  const { loadDemoFactory, resetAndSeedDemo } = useApp();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-transparent dark:border-white/10 shadow-[0_1px_2px_rgba(17,20,45,0.04),0_10px_28px_-14px_rgba(17,20,45,0.10)] dark:shadow-none p-6 shadow-xs space-y-4">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-indigo-600" />
          <span>Demo Ledger Data</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Load or restore the canonical demonstration factory.
        </p>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed">
          <strong className="font-bold">Reset &amp; Seed</strong> deletes every record in the cloud
          ledger and reloads the canonical factory — a below-threshold material, an overdue invoice
          and an unregistered buyer — so the autonomous agents have something real to act on. Export a
          backup first if you want the current ledger back.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resetAndSeedDemo}
          title="Wipe the cloud ledger and reload the canonical demo factory"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Reset &amp; Seed Demo
        </button>
        <button
          type="button"
          onClick={loadDemoFactory}
          title="Add the demo factory records to the current ledger"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
        >
          Load Demo Factory
        </button>
      </div>
    </div>
  );
};