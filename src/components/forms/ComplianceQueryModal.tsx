import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { queryComplianceRAG, RAGQueryResult } from '../../lib/ragCompliance';
import { Scale, X, Search, BookOpen, Calendar, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

export const ComplianceQueryModal: React.FC = () => {
  const { activeModal, closeModal, complianceSources } = useApp();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RAGQueryResult | null>(null);

  if (activeModal !== 'compliance') return null;

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResult(null);
      return;
    }
    const res = queryComplianceRAG(complianceSources, searchQuery);
    setResult(res);
  };

  const sampleQueries = [
    'What is the standard GST rate for textile manufacturing?',
    'Withholding tax section 153 rate for active filers',
    'FBR monthly sales tax filing deadlines and Annexure-C',
    'SRO 345(I)/2024 export zero-rating criteria'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-200 text-indigo-800 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-indigo-950">FBR Compliance RAG Knowledge Query</h3>
              <p className="text-xs text-indigo-700">Authoritative statutory retrieval grounded in Pakistani tax laws</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="text-indigo-400 hover:text-indigo-700 p-1.5 rounded-lg hover:bg-indigo-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search tax rules, section 153 WHT, SRO 345, GST rates, filing deadlines..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium"
            />
          </div>

          {/* Quick preset chips */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Verified Legal Queries:
            </span>
            <div className="flex flex-wrap gap-2">
              {sampleQueries.map((sq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(sq)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-900 text-slate-700 rounded-lg text-xs font-medium transition-colors text-left flex items-center gap-1 cursor-pointer"
                >
                  <span>{sq}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Result Card */}
          {result && (
            <div className="mt-4 p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {result.citation}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                  RAG Confidence: {(result.confidence * 100).toFixed(0)}%
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed font-sans bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                {result.explanation}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Applicable GST</span>
                  <span className="text-sm font-bold text-indigo-900">{result.gstRate}%</span>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">WHT Sec 153 Rate</span>
                  <span className="text-sm font-bold text-indigo-900">{result.withholdingRate > 0 ? `${result.withholdingRate}%` : 'Exempt'}</span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Statutory Filing</span>
                  <span className="text-xs font-semibold text-slate-800">{result.filingDeadline}</span>
                </div>
              </div>
            </div>
          )}

          {/* Static Sources Reference */}
          <div className="pt-3 border-t border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Indexed Statutory Repositories:
            </span>
            <div className="space-y-2">
              {complianceSources.map(s => (
                <div key={s.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{s.documentName}</div>
                    <div className="text-[11px] text-slate-500">{s.section}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded text-[10px] font-mono">
                    Verified FBR
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={closeModal}
            className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
