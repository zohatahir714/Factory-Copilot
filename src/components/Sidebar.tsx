import React from 'react';
import { useApp, AppTab } from '../context/AppContext';
import {
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  History,
  Bot,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Settings,
  LogOut,
  Mic,
  Sun,
  Moon,
  BarChart3
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    toggleSidebar,
    products,
    suppliers,
    customers,
    purchaseOrders,
    salesOrders,
    openModal,
    branding,
    currentUser,
    logout,
    darkMode,
    toggleDarkMode
  } = useApp();

  const lowStockCount = products.filter(p => p.currentStock <= p.reorderThreshold).length;
  const pendingPOCount = purchaseOrders.filter(p => p.status === 'pending').length;

  interface NavItem {
    id: AppTab;
    label: string;
    urdu: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeColor?: string;
  }

  interface NavSection {
    id: string;
    title: string;
    urdu: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      id: 'core',
      title: 'Command & AI',
      urdu: 'مرکزی کنٹرول',
      items: [
        {
          id: 'dashboard',
          label: 'Executive Dashboard',
          urdu: 'مرکزی ڈیش بورڈ',
          icon: <LayoutDashboard className="w-5 h-5" />
        },
        {
          id: 'copilot',
          label: 'AI Copilot Terminal',
          urdu: 'اے آئی مشیر',
          icon: <Bot className="w-5 h-5" />
        }
      ]
    },
    {
      id: 'supply_chain',
      title: 'Supply Chain & Stock',
      urdu: 'سپلائی چین اور گودام',
      items: [
        {
          id: 'inventory',
          label: 'Inventory & Materials',
          urdu: 'اسٹاک اور خام مال',
          icon: <Package className="w-5 h-5" />,
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeColor: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
        },
        {
          id: 'purchase',
          label: 'Purchase Orders',
          urdu: 'خریداری آرڈرز',
          icon: <ShoppingCart className="w-5 h-5" />,
          badge: pendingPOCount > 0 ? pendingPOCount : undefined,
          badgeColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
        },
        {
          id: 'suppliers',
          label: 'Suppliers & Vendors',
          urdu: 'سپلائرز اور وینڈرز',
          icon: <Building2 className="w-5 h-5" />
        },
        {
          id: 'movements',
          label: 'Stock Audit Trail',
          urdu: 'گودام آڈٹ لاگ',
          icon: <History className="w-5 h-5" />
        }
      ]
    },
    {
      id: 'commerce',
      title: 'Sales & Commercial',
      urdu: 'سیلز اور کسٹمرز',
      items: [
        {
          id: 'sales',
          label: 'Sales & 18% GST',
          urdu: 'فروخت اور انوائس',
          icon: <Receipt className="w-5 h-5" />,
          badge: salesOrders.length > 0 ? salesOrders.length : undefined
        },
        {
          id: 'customers',
          label: 'Customers & Mills',
          urdu: 'کسٹمرز اور ملز',
          icon: <Users className="w-5 h-5" />,
          badge: customers.length > 0 ? customers.length : undefined
        }
      ]
    },
    {
      id: 'finance',
      title: 'Treasury & Taxation',
      urdu: 'مالیات اور ٹیکس',
      items: [
        {
          id: 'cashbook',
          label: 'Cashbook & Vouchers',
          urdu: 'روکڑ اور واؤچرز',
          icon: <Wallet className="w-5 h-5" />
        },
        {
          id: 'reports',
          label: 'Reports & Financials',
          urdu: 'مالیاتی رپورٹس اور لیجر',
          icon: <BarChart3 className="w-5 h-5" />
        },
        {
          id: 'compliance',
          label: 'FBR Compliance RAG',
          urdu: 'ٹیکس ریگولیشنز',
          icon: <Scale className="w-5 h-5" />,
          badge: '18%',
          badgeColor: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
        },
        {
          id: 'fbr_integration',
          label: 'FBR Digital Invoicing',
          urdu: 'ڈیجیٹل انوائسنگ حب',
          icon: <ShieldCheck className="w-5 h-5" />,
          badge: 'Ready',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        }
      ]
    },
    {
      id: 'administration',
      title: 'Administration',
      urdu: 'سسٹم ترتیبات',
      items: [
        {
          id: 'settings',
          label: 'Settings & Branding',
          urdu: 'ترتیبات و برانڈنگ',
          icon: <Settings className="w-5 h-5" />
        }
      ]
    }
  ];

  return (
    <aside
      className={`relative bg-white/90 dark:bg-[#0e0f14] text-slate-700 dark:text-slate-200 border-r border-slate-200/70 dark:border-white/5 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 select-none z-10 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header / Branding & Collapse Pill Button */}
      <div className={`p-3.5 border-b border-slate-200 dark:border-slate-800/90 flex ${sidebarCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between'}`}>
        {/* Brand Logo - ALWAYS VISIBLE */}
        <div
          className="flex items-center gap-3 overflow-hidden cursor-pointer"
          onClick={() => setActiveTab('settings')}
          title={`Edit Branding: ${branding.companyName}`}
        >
          {branding.logoBase64 ? (
            <div className="w-10 h-10 rounded-xl bg-white p-1 shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center">
              <img src={branding.logoBase64} alt={branding.companyName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="truncate">
              <div className="text-xs font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {branding.companyName.split(' ')[0]} {branding.companyName.split(' ')[1] || ''}
              </div>
              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Factory Ledger</span>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Minimize / Maximize Pill Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs cursor-pointer"
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation List - Structured Enterprise Modules */}
      <div className="p-3 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
        {navSections.map((section, idx) => (
          <div key={section.id} className="space-y-1">
            {/* Section Header */}
            {!sidebarCollapsed ? (
              <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.title}
                </span>
                <span className="text-[9px] text-slate-400/80 dark:text-slate-600 font-urdu">
                  {section.urdu}
                </span>
              </div>
            ) : (
              idx > 0 && <div className="my-2 mx-1 border-t border-slate-200 dark:border-slate-800/80" />
            )}

            {/* Section Items */}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative group cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/5 border border-transparent'
                    }`}
                    title={sidebarCollapsed ? `[${section.title}] ${item.label} (${item.urdu})` : undefined}
                  >
                    <div
                      className={`shrink-0 transition-colors ${
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-400 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                      }`}
                    >
                      {item.icon}
                    </div>

                    {!sidebarCollapsed && (
                      <div className="flex-1 flex items-center justify-between truncate text-left">
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold leading-none ${
                              item.badgeColor || 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Hover tooltip for collapsed state */}
                    {sidebarCollapsed && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                        <div className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold">{section.title}</div>
                        <div>{item.label}</div>
                        <div className="text-[10px] text-slate-400 font-urdu">{item.urdu}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Voice Assistant Pill */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/90">
        <button
          onClick={() => openModal('voice')}
          className={`w-full flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700/60 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all cursor-pointer ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
          title="Instant Voice Command (English/Urdu)"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4" />
          </div>
          {!sidebarCollapsed && (
            <div className="text-left text-xs truncate">
              <div className="font-bold text-slate-800 dark:text-white">Voice Command</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">اردو · Voice First</div>
            </div>
          )}
        </button>
      </div>

      {/* Theme Toggle & User Profile Footer */}
      <div className="p-3 border-t border-slate-200/70 dark:border-white/5 space-y-2">
        {/* Dark/Light Mode Switch */}
        <button
          type="button"
          onClick={toggleDarkMode}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400 shrink-0" /> : <Moon className="w-4 h-4 text-slate-600 shrink-0" />}
          {!sidebarCollapsed && (
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          )}
        </button>

        {currentUser ? (
          <div className="flex items-center justify-between pt-1">
            {!sidebarCollapsed ? (
              <div
                className="flex items-center gap-2.5 overflow-hidden cursor-pointer flex-1"
                onClick={() => setActiveTab('settings')}
                title="Account Settings"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-xs font-bold shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="truncate text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{currentUser.role}</div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('settings')}
                className="w-8 h-8 mx-auto rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                title={`${currentUser.name} (${currentUser.role})`}
              >
                {currentUser.name.charAt(0)}
              </button>
            )}

            {!sidebarCollapsed && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer shrink-0 ml-1"
                title="Log Out Session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setActiveTab('settings')}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
};
