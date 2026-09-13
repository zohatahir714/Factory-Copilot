import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Mic,
  Plus,
  Building2,
  ShieldCheck,
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  Scale,
  X,
  ChevronDown,
  Command,
  Settings,
  User,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    branding,
    searchQuery,
    setSearchQuery,
    openModal,
    setActiveTab,
    products,
    purchaseOrders,
    salesOrders,
    customers,
    suppliers,
    complianceSources,
    currentUser,
    darkMode,
    toggleDarkMode,
    syncDatabase,
    addToast
  } = useApp();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  // Close search and quick menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (quickMenuRef.current && !quickMenuRef.current.contains(event.target as Node)) {
        setIsQuickMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    syncDatabase();
    setTimeout(() => {
      setIsSyncing(false);
      addToast('success', 'Data Refreshed', 'Database ledgers and trend metrics synchronized.');
    }, 700);
  };

  // Filter items based on searchQuery
  const q = searchQuery.toLowerCase().trim();
  const filteredProducts = q ? products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : [];
  const filteredPOs = q ? purchaseOrders.filter(p => p.poNumber.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)) : [];
  const filteredSales = q ? salesOrders.filter(s => s.invoiceNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q)) : [];
  const filteredSuppliers = q ? suppliers.filter(s => s.name.toLowerCase().includes(q)) : [];
  const filteredCustomers = q ? customers.filter(c => c.name.toLowerCase().includes(q)) : [];
  const filteredCompliance = q ? complianceSources.filter(cs => cs.documentName.toLowerCase().includes(q) || cs.section.toLowerCase().includes(q)) : [];

  const totalResults =
    filteredProducts.length +
    filteredPOs.length +
    filteredSales.length +
    filteredSuppliers.length +
    filteredCustomers.length +
    filteredCompliance.length;

  return (
    <header className="sticky top-2 z-40 mx-4 my-2">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl px-4 lg:px-6 py-2.5 flex items-center justify-between gap-3 transition-colors">
        {/* Left: Brand Identity (Local Storage Driven) */}
        <div
          className="flex items-center gap-3 min-w-max cursor-pointer"
          onClick={() => setActiveTab('settings')}
          title="Open Branding Settings"
        >
          {branding.logoBase64 ? (
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 overflow-hidden flex items-center justify-center shadow-xs">
              <img src={branding.logoBase64} alt="Brand Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                {branding.companyName}
              </h1>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>{branding.tagline || 'Industrial Operations & ERP Ledger'}</span>
            </div>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div ref={searchRef} className="relative flex-1 max-w-xl mx-2 lg:mx-6">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Global Search (Items, POs, Tax Invoices, FBR Rules, Vendors)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-9 pr-8 py-2 text-xs lg:text-sm bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 bg-slate-200/60 dark:bg-slate-700 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <Command className="w-2.5 h-2.5" /> K
              </span>
            )}
          </div>

          {/* Search Dropdown Overlay */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-96 overflow-y-auto z-50 animate-fadeIn text-xs divide-y divide-slate-100 dark:divide-slate-700">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-[11px]">Search Results ({totalResults})</span>
                <span className="text-[10px] font-mono">Press ESC to dismiss</span>
              </div>

              {totalResults === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500">
                  No records matching &quot;{searchQuery}&quot; found across products, orders, or compliance rules.
                </div>
              ) : (
                <div className="py-1">
                  {/* Products */}
                  {filteredProducts.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                        <Package className="w-3 h-3 text-emerald-600" /> Products & Raw Materials ({filteredProducts.length})
                      </div>
                      {filteredProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setActiveTab('inventory');
                            setIsSearchOpen(false);
                          }}
                          className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{p.name}</span>
                            <span className="text-slate-400 ml-2 font-mono text-[11px]">SKU: {p.sku}</span>
                          </div>
                          <span className="font-mono text-slate-600 dark:text-slate-300">
                            {p.currentStock} {p.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Purchase Orders */}
                  {filteredPOs.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3 text-amber-600" /> Purchase Orders ({filteredPOs.length})
                      </div>
                      {filteredPOs.map(po => (
                        <div
                          key={po.id}
                          onClick={() => {
                            setActiveTab('purchase');
                            setIsSearchOpen(false);
                          }}
                          className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-bold font-mono text-slate-800 dark:text-slate-100">{po.poNumber}</span>
                            <span className="text-slate-600 dark:text-slate-300 ml-2">{po.supplierName}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            Rs. {po.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sales Invoices */}
                  {filteredSales.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-blue-600" /> Sales Orders & GST Invoices ({filteredSales.length})
                      </div>
                      {filteredSales.map(so => (
                        <div
                          key={so.id}
                          onClick={() => {
                            setActiveTab('sales');
                            setIsSearchOpen(false);
                          }}
                          className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-bold font-mono text-blue-600 dark:text-blue-400">{so.invoiceNumber}</span>
                            <span className="text-slate-600 dark:text-slate-300 ml-2">{so.customerName}</span>
                          </div>
                          <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                            Rs. {so.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compliance Sources */}
                  {filteredCompliance.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                        <Scale className="w-3 h-3 text-purple-600" /> FBR Statutory Legal Rules ({filteredCompliance.length})
                      </div>
                      {filteredCompliance.map(cs => (
                        <div
                          key={cs.id}
                          onClick={() => {
                            setActiveTab('compliance');
                            setIsSearchOpen(false);
                          }}
                          className="px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100">{cs.title}</span>
                            <span className="text-blue-600 dark:text-blue-400 ml-2 font-mono text-[11px]">{cs.section}</span>
                          </div>
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded font-mono">
                            {cs.authority}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Quick Action Modals + Theme Toggle + Voice Assistant */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Voice Assistant Shortcut */}
          <button
            type="button"
            onClick={() => openModal('voice')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Speak command in Urdu or English"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voice</span>
          </button>

          {/* Quick Create Dropdown Menu */}
          <div ref={quickMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsQuickMenuOpen(!isQuickMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Quick Entry</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isQuickMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-fadeIn text-xs">
                <button
                  type="button"
                  onClick={() => {
                    openModal('product');
                    setIsQuickMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Add Raw Material / SKU</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openModal('purchase');
                    setIsQuickMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Issue Purchase Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openModal('sale');
                    setIsQuickMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Record Sale (18% GST Invoice)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openModal('expense');
                    setIsQuickMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <Wallet className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  <span>Post Cashbook Voucher</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    openModal('compliance');
                    setIsQuickMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-purple-700 dark:text-purple-300 font-semibold cursor-pointer"
                >
                  <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Query FBR RAG Compliance</span>
                </button>
              </div>
            )}
          </div>

          {/* Settings Shortcut Button */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Settings & Branding"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
