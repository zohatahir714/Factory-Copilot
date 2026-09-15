import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ComboOption {
  key: string;
  label: string;
  hint?: string;
  group?: string;
  /** Caller-attached data (e.g. the full option record) returned on select. */
  payload?: unknown;
}

interface Props {
  options: ComboOption[];
  /** Selected option key. */
  value?: string;
  onSelect: (option: ComboOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Renders the closed trigger; falls back to `${hint} · ${label}` of the matched option. */
  renderTrigger?: (selected: ComboOption | undefined) => React.ReactNode;
  className?: string;
  listWidthClassName?: string;
  ariaLabel?: string;
}

/**
 * ONE searchable, fully keyboard-driven dropdown for account-style choices.
 * ↑↓ move (wrapping) · Home/End jump · Enter select · Esc/Tab close · type to filter.
 * The listbox auto-scrolls the active option into view and is ARIA-wired
 * (combobox trigger → listbox/option). Enter never propagates to parent forms
 * while the panel is open.
 */
export const AccountCombobox: React.FC<Props> = ({
  options,
  value,
  onSelect,
  placeholder = 'Search…',
  searchPlaceholder = 'Type to search…  (↑↓ browse · Enter select · Esc close)',
  renderTrigger,
  className = '',
  listWidthClassName = 'w-[min(24rem,85vw)]',
  ariaLabel = 'Search options'
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = useMemo(() => options.find(o => o.key === value), [options, value]);

  const flatFiltered: ComboOption[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => `${o.hint ?? ''} ${o.label} ${o.group ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  // Anchor the highlight on open and on query change (NOT on every render —
  // an effect on flatFiltered's identity would fight arrow-key navigation).
  useEffect(() => {
    if (open) setActiveIdx(flatFiltered.length > 0 ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  // Keep the active option inside the scrollport (scrolls only when needed).
  useEffect(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    if (!el) return;
    const box = listRef.current;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [activeIdx, open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const openPanel = () => {
    setQuery('');
    setActiveIdx(options.length > 0 ? 0 : -1);
    setOpen(true);
  };

  const commit = (opt: ComboOption | undefined) => {
    if (!opt) return;
    onSelect(opt);
    close();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        openPanel();
      }
      return;
    }
    const last = flatFiltered.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => (i < 0 ? 0 : (i + 1) % flatFiltered.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => (i <= 0 ? last : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIdx(last >= 0 ? 0 : -1);
        break;
      case 'End':
        e.preventDefault();
        setActiveIdx(last);
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        commit(flatFiltered[activeIdx]);
        break;
      case 'Escape':
      case 'Tab':
        e.stopPropagation();
        close();
        break;
    }
  };

  let running = 0;
  const groups = [...new Set(flatFiltered.map(o => o.group || 'Options'))];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 text-left text-xs field-input outline-none font-semibold flex items-center justify-between gap-1.5 ${className.includes('py-1.5') ? 'py-1.5' : ''}`}
        title={ariaLabel}
      >
        <span className={`truncate ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500 font-normal'}`}>
          {renderTrigger
            ? renderTrigger(selected)
            : selected
              ? [selected.hint, selected.label].filter(Boolean).join(' · ')
              : placeholder}
        </span>
        <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.23 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-30 mt-1 ${listWidthClassName} max-h-80 overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#1a1b23] shadow-xl border border-transparent dark:border-white/10 p-1.5 animate-fadeIn`}
        >
          <div className="sticky top-0 bg-white dark:bg-[#1a1b23] p-1 pb-1.5 z-10">
            <input
              autoFocus
              type="text"
              role="searchbox"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              aria-label={ariaLabel}
              className="w-full px-3 py-1.5 text-xs field-input outline-none"
            />
          </div>
          {flatFiltered.length === 0 && (
            <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">No matches for “{query}”</div>
          )}
          {groups.map(g => (
            <div key={g} className="mt-1">
              {groups.length > 1 && (
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{g}</div>
              )}
              {flatFiltered
                .filter(o => (o.group || 'Options') === g)
                .map(o => {
                  const idx = running++;
                  const active = idx === activeIdx;
                  const isSelected = o.key === value;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      role="option"
                      data-idx={idx}
                      aria-selected={active}
                      onMouseMove={() => setActiveIdx(idx)}
                      onClick={() => commit(o)}
                      className={`w-full px-2.5 py-1.5 text-left rounded-lg transition-colors cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : isSelected
                            ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10'
                            : 'text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-500/15'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">
                        {o.label}
                        {isSelected && !active && <span className="ml-1.5 text-[9px] uppercase tracking-wide opacity-70">selected</span>}
                      </div>
                      {o.hint && (
                        <div className={`text-[10px] font-mono ${active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>{o.hint}</div>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountCombobox;
