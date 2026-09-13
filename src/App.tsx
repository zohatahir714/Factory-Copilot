/**
 * AI Business Copilot for Manufacturing SMEs
 * Master Application Shell
 * Compliant with PRD v3.0, RAG Compliance, Custom Branding & CRUD
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { CopilotChatView } from './components/CopilotChatView';
import { DatabaseInspector } from './components/DatabaseInspector';
import { SettingsView } from './components/SettingsView';
import { FBRIntegrationHub } from './components/FBRIntegrationHub';
import { LoginScreen } from './components/LoginScreen';
import { Toasts } from './components/Toasts';

// CRUD Action Modals
import { ViewDetailsModal } from './components/modals/ViewDetailsModal';
import { EditItemModal } from './components/modals/EditItemModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { PrintDocumentModal } from './components/modals/PrintDocumentModal';

// Creation Forms Modals
import { ProductCreateModal } from './components/forms/ProductCreateModal';
import { SupplierCreateModal } from './components/forms/SupplierCreateModal';
import { CustomerCreateModal } from './components/forms/CustomerCreateModal';
import { PurchaseOrderCreateModal } from './components/forms/PurchaseOrderCreateModal';
import { SalesOrderCreateModal } from './components/forms/SalesOrderCreateModal';
import { CashbookCreateModal } from './components/forms/CashbookCreateModal';
import { AccountCreateModal } from './components/forms/AccountCreateModal';
import { ComplianceQueryModal } from './components/forms/ComplianceQueryModal';
import { CashbookModule } from './components/CashbookModule';
import { ReportsModule } from './components/ReportsModule';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { Mic, Bot } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, openModal, isAuthenticated } = useApp();

  // Auth gate: render ONLY the login screen until authenticated. The operational
  // workspace (sidebar, header, modules) must never mount behind it.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200 selection:bg-blue-600 selection:text-white">
        <LoginScreen />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200 selection:bg-blue-600 selection:text-white">
      {/* Left Collapsible Sidebar with High Contrast & Dynamic Branding */}
      <Sidebar />

      {/* Right Core Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Floating Hovering Header with Global Search, Quick Actions & Badges */}
        <Header />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-6 pb-6 pt-1">
          {activeTab === 'dashboard' && <ExecutiveDashboard />}
          {activeTab === 'copilot' && <CopilotChatView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'fbr_integration' && <FBRIntegrationHub />}
          {activeTab === 'cashbook' && <CashbookModule />}
          {activeTab === 'reports' && <ReportsModule />}
          {activeTab !== 'dashboard' && activeTab !== 'copilot' && activeTab !== 'settings' && activeTab !== 'fbr_integration' && activeTab !== 'cashbook' && activeTab !== 'reports' && <DatabaseInspector />}
        </main>

        {/* Floating Action Bar for 1-Click Voice & AI Copilot Dispatch */}
        {activeTab !== 'copilot' && (
          <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
            <button
              onClick={() => openModal('voice')}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title="Speak in Urdu or English"
            >
              <Mic className="w-5 h-5 group-hover:animate-bounce" />
              <span className="text-xs font-bold tracking-tight">Voice Assistant (Urdu/Eng)</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className="p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Open AI Copilot Terminal"
            >
              <Bot className="w-5 h-5 text-blue-400" />
            </button>
          </div>
        )}
      </div>

      {/* Inspection, Editing & Deletion Modals */}
      <ViewDetailsModal />
      <EditItemModal />
      <DeleteConfirmModal />
      <PrintDocumentModal />

      {/* All Module Creation Forms (Modals) */}
      <ProductCreateModal />
      <SupplierCreateModal />
      <CustomerCreateModal />
      <PurchaseOrderCreateModal />
      <SalesOrderCreateModal />
      <CashbookCreateModal />
      <AccountCreateModal />
      <ComplianceQueryModal />
      <VoiceAssistantModal />

      {/* Real-time Toast Alerts */}
      <Toasts />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
