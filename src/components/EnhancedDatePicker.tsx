import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

type PresetId = 'today' | 'this_month' | 'last_month' | 'fy' | 'custom';

interface Props {
  /** Range mode (default): From/To inputs driven by presets. */
  mode?: 'range' | 'single';
  startDate?: string;
  endDate?: string;
  singleDate?: string;
  onChangeRange?: (start: string, end: string, preset: PresetId) => void;
  onChangeSingle?: (date: string) => void;
  className?: string;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'fy', label: 'Fiscal Year' }
];

/**
 * Enhanced date filter: preset chips (Today / This Month / Last Month /
 * Pakistani fiscal year) plus native date inputs, wrapped in a pill menu so
 * the filter collapses to one control. Keyboard-friendly, dark-mode aware.
 * Fiscal year = 1 Jul – 30 Jun.
 */
export const EnhancedDatePicker: React.FC<Props> = ({
  mode = 'range',
  startDate,
  endDate,
  singleDate,
  onChangeRange,
  onChangeSingle,
  className = ''
}) => {
  const today = useMemo(() => fmt(new Date()), []);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetId>('this_month');
  const [start, setStart] = useState(startDate || useMemo(() => fmt(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), []));
  const [end, setEnd] = useState(endDate || today);
  const [single, setSingle] = useState(singleDate || today);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    const now = new Date();
    if (id === 'today') {
      setStart(today); setEnd(today); if (mode === 'single') setSingle(today);
      onChangeRange?.(today, today, id); if (mode === 'single') onChangeSingle?.(today);
    } else if (id === 'this_month') {
      const s = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
      setStart(s); setEnd(today);
      onChangeRange?.(s, today, id);
    } else if (id === 'last_month') {
      const s = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const e = fmt(new Date(now.getFullYear(), now.getMonth(), 0));
      setStart(s); setEnd(e);
      onChangeRange?.(s, e, id);
    } else if (id === 'fy') {
      const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      const s = `${y}-07-01`;
      const e = `${y + 1}-06-30`;
      setStart(s); setEnd(e);
      onChangeRange?.(s, e, id);
    }
  };

  const summary =
    mode === 'single'
      ? single
      : `${start} → ${end}`;

  const inputCls =
    'w-full px-3 py-1.5 text-xs field-input outline-none font-mono font-bold';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="px-3.5 py-2 rounded-full text-xs font-bold field-input flex items-center gap-2 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Filter by period"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
        <span className="font-mono">{summary}</span>
        <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.23 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Period filter"
          className="absolute z-30 right-0 mt-1.5 w-[min(21rem,88vw)] rounded-2xl bg-white dark:bg-[#1a1b23] shadow-xl border border-transparent dark:border-white/10 p-3 space-y-2.5 animate-fadeIn"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quick presets</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-colors cursor-pointer ${
                  preset === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {mode === 'single' ? (
            <div>
              <label className="field-label">Date</label>
              <input
                type="date"
                value={single}
                onChange={e => {
                  setSingle(e.target.value);
                  setPreset('custom');
                  onChangeSingle?.(e.target.value);
                }}
                className={inputCls}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label">From</label>
                <input
                  type="date"
                  value={start}
                  max={end}
                  onChange={e => {
                    setStart(e.target.value);
                    setPreset('custom');
                    onChangeRange?.(e.target.value, end, 'custom');
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="field-label">To</label>
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={e => {
                    setEnd(e.target.value);
                    setPreset('custom');
                    onChangeRange?.(start, e.target.value, 'custom');
                  }}
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedDatePicker;
