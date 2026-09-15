import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

type PresetId = 'today' | 'this_month' | 'last_month' | 'fy' | 'custom';

interface Props {
  /** Range mode (default): pick a From→To span on one calendar. */
  mode?: 'range' | 'single';
  startDate?: string;
  endDate?: string;
  singleDate?: string;
  onChangeRange?: (start: string, end: string, preset: PresetId) => void;
  onChangeSingle?: (date: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']; // Sunday-first columns

/** Exactly the days of the viewed month (no leading/trailing overflow rows). */
function monthDays(year: number, month: number): Date[] {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Date[] = [];
  for (let i = 1; i <= days; i++) cells.push(new Date(Date.UTC(year, month, i)));
  return cells;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const PANEL_W = 304; // 19rem

/**
 * Enhanced date filter: preset chips (Today / This Month / Last Month /
 * Fiscal Year) and a custom month calendar with click-click range selection.
 * English labels; grid contains only the viewed month's days laid under the
 * correct weekday columns.
 *
 * The panel is portaled to document.body and positioned `fixed` from the
 * trigger's viewport rect, so no ancestor overflow-hidden/scroll container or
 * stacking context (module roots, modals, tables) can clip or bury it. It
 * flips above/below, clamps to the viewport, tracks scroll, and closes when
 * the trigger scrolls away.
 */
export const EnhancedDatePicker: React.FC<Props> = ({
  mode = 'range',
  startDate,
  endDate,
  singleDate,
  onChangeRange,
  onChangeSingle,
  className = '',
  align = 'right'
}) => {
  const today = useMemo(() => fmt(new Date()), []);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetId>('this_month');
  const [start, setStart] = useState(startDate || fmt(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [end, setEnd] = useState(endDate || today);
  const [single, setSingle] = useState(singleDate || today);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setPendingStart(null); }, []);

  const computeCoords = useCallback(() => {
    const trig = rootRef.current?.getBoundingClientRect();
    if (!trig) return;
    const ph = panelRef.current?.offsetHeight || 360;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = Math.min(PANEL_W, vw - margin * 2);
    let left = align === 'right' ? trig.right - pw : trig.left;
    left = Math.max(margin, Math.min(left, vw - pw - margin));
    const spaceBelow = vh - trig.bottom - 6;
    const spaceAbove = trig.top - 6;
    let top: number;
    let maxHeight: number;
    if (spaceBelow >= ph) { top = trig.bottom + 6; maxHeight = vh - top - margin; }
    else if (spaceAbove >= ph) { top = trig.top - ph - 6; maxHeight = ph; }
    else if (spaceBelow >= spaceAbove) { top = trig.bottom + 6; maxHeight = spaceBelow - margin; }
    else { maxHeight = spaceAbove - margin; top = Math.max(margin, trig.top - maxHeight - 6); }
    top = Math.max(margin, Math.min(top, vh - margin));
    maxHeight = Math.max(220, Math.min(maxHeight, vh - top - margin));
    setCoords({ left: Math.round(left), top: Math.round(top), width: Math.round(pw), maxHeight: Math.round(maxHeight) });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) { setCoords(null); return; }
    computeCoords();
    const onMove = () => {
      const trig = rootRef.current?.getBoundingClientRect();
      if (!trig) return;
      // Trigger scrolled out of view — the picker is meaningless; close it.
      if (trig.bottom < -24 || trig.top > window.innerHeight + 24) { close(); return; }
      computeCoords();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, computeCoords, close]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    const now = new Date();
    if (id === 'today') {
      setStart(today); setEnd(today);
      if (mode === 'single') { setSingle(today); onChangeSingle?.(today); }
      else onChangeRange?.(today, today, id);
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
      setViewYear(y); setViewMonth(6);
    }
  };

  const handleDayClick = (d: Date) => {
    const day = iso(d);
    if (mode === 'single') {
      setSingle(day);
      setPreset('custom');
      onChangeSingle?.(day);
      close();
      return;
    }
    if (!pendingStart) {
      setPendingStart(day);
    } else {
      const s = pendingStart <= day ? pendingStart : day;
      const e = pendingStart <= day ? day : pendingStart;
      setStart(s); setEnd(e);
      setPreset('custom');
      setPendingStart(null);
      onChangeRange?.(s, e, 'custom');
      setTimeout(() => setOpen(false), 160);
    }
  };

  const summary = mode === 'single' ? single : `${start} → ${end}`;
  const days = monthDays(viewYear, viewMonth);
  // Weekday column of the 1st for Sunday-first headers (0 = Su column).
  const leadBlanks = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
  const rangeStart = pendingStart || start;
  const rangeEnd = pendingStart ? pendingStart : end;

  const dayCls = (d: Date) => {
    const day = iso(d);
    const isToday = day === today;
    const inRange = day >= rangeStart && day <= rangeEnd;
    const isEdge = day === rangeStart || day === rangeEnd;
    const base = 'h-8 text-[11px] rounded-lg flex items-center justify-center transition-colors cursor-pointer';
    if (isEdge) return `${base} bg-indigo-600 text-white font-bold`;
    if (inRange) return `${base} bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 font-semibold`;
    if (isToday) return `${base} text-indigo-700 dark:text-indigo-300 font-bold ring-1 ring-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/15`;
    return `${base} text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15`;
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="px-3.5 py-2 rounded-full text-xs font-bold field-input flex items-center gap-2 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Select period"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
        <span className="font-mono" dir="ltr">{summary}</span>
        <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.23 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Select period"
          className="fixed rounded-2xl bg-white dark:bg-[#1a1b23] shadow-xl border border-transparent dark:border-white/10 p-3 space-y-2.5 animate-fadeIn overflow-y-auto"
          style={{ left: coords.left, top: coords.top, width: coords.width, maxHeight: coords.maxHeight, zIndex: 70 }}
        >
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'fy', label: 'Fiscal Year' }
            ] as Array<{ id: PresetId; label: string }>).map(p => (
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

          {/* Month header */}
          <div className="flex items-center justify-between pt-0.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                const m = viewMonth - 1;
                if (m < 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m);
              }}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => {
                const m = viewMonth + 1;
                if (m > 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m);
              }}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday header (Sunday-first) */}
          <div className="grid grid-cols-7 gap-0.5">
            {DOW.map((d, i) => (
              <div key={i} className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 text-center py-0.5">{d}</div>
            ))}
          </div>

          {/* Day grid — only this month's days, aligned under real columns */}
          <div className="grid grid-cols-7 gap-0.5" style={{ gridAutoRows: '2rem' }}>
            {Array.from({ length: leadBlanks }).map((_, i) => (
              <div key={`blank_${i}`} />
            ))}
            {days.map(d => (
              <button key={iso(d)} type="button" onClick={() => handleDayClick(d)} className={dayCls(d)}>
                {d.getUTCDate()}
              </button>
            ))}
          </div>

          {/* Selected range readout */}
          <div className="pt-1 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400" dir="ltr">
            <span>{mode === 'single' ? single : start}</span>
            {mode !== 'single' && <span className="text-indigo-500">→</span>}
            {mode !== 'single' && <span>{end}</span>}
          </div>
          {mode !== 'single' && pendingStart && (
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold text-center">
              Select the end date…
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnhancedDatePicker;
