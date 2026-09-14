import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { testGroqConnection, GroqTestResult } from '../lib/groqClient';
import {
  checkSupabaseHealth,
  DatabaseHealthStatus,
  SUPABASE_SQL_SCHEMA
} from '../lib/supabaseClient';
import {
  Settings,
  Building2,
  Cpu,
  User,
  Users,
  ShieldCheck,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Key,
  Save,
  RefreshCw,
  LogOut,
  Database,
  Cloud,
  FileCode,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Server,
  UserPlus,
  Edit3,
  Lock,
  Phone,
  Mail,
  Shield
} from 'lucide-react';
import { UserRole } from '../types';

export const SettingsView: React.FC = () => {
  const {
    branding,
    updateBranding,
    aiSettings,
    updateAISettings,
    currentUser,
    logout,
    resetAllData,
    products,
    suppliers,
    customers,
    purchaseOrders,
    salesOrders,
    cashbook,
    accounts,
    inventoryMovements,
    syncDatabase,
    addToast,
    userAccounts,
    createUserAccount,
    updateUserAccount,
    deleteUserAccount
  } = useApp();

  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.permissions?.canManageUsers;

  const [activeTab, setActiveTab] = useState<'database' | 'users' | 'branding' | 'ai' | 'account' | 'tax'>('database');

  const activeBranding = branding || {
    companyName: 'Industrial Manufacturing Solutions',
    tagline: 'Enterprise SME Operating System',
    ntnNumber: '1234567-8',
    strnNumber: '03-00-1234-001-00',
    city: 'Lahore, Pakistan',
    logoBase64: ''
  };

  // Branding Form State
  const [brandForm, setBrandForm] = useState({
    companyName: activeBranding.companyName,
    tagline: activeBranding.tagline,
    ntnNumber: activeBranding.ntnNumber,
    strnNumber: activeBranding.strnNumber,
    city: activeBranding.city,
    logoBase64: activeBranding.logoBase64
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image should be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setBrandForm(prev => ({ ...prev, logoBase64: base64 }));
      updateBranding({ logoBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setBrandForm(prev => ({ ...prev, logoBase64: '' }));
    updateBranding({ logoBase64: '' });
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    updateBranding(brandForm);
  };

  // AI & Groq State
  const [selectedModel, setSelectedModel] = useState(aiSettings.selectedModel || '');
  const [testResult, setTestResult] = useState<GroqTestResult | null>(null);
  const [testingGroq, setTestingGroq] = useState(false);

  const handleTestGroq = async () => {
    setTestingGroq(true);
    setTestResult(null);
    try {
      const result = await testGroqConnection();
      setTestResult(result);
    } finally {
      setTestingGroq(false);
    }
  };

  const handleSaveAI = (e: React.FormEvent) => {
    e.preventDefault();
    updateAISettings({ selectedModel });
  };

  // Database & Supabase State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(() => {
    return localStorage.getItem('copilot_supabase_url') || ((import.meta as any)?.env?.VITE_SUPABASE_URL || '');
  });
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(() => {
    return localStorage.getItem('copilot_supabase_key') || ((import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || '');
  });
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // User Provisioning State (Super Admin Only)
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Admin');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>('Admin');
  const [editingPassword, setEditingPassword] = useState('');

  const checkHealth = async () => {
    const health = await checkSupabaseHealth();
    setDbHealth(health);
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleSaveDatabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDb(true);
    try {
      if (supabaseUrlInput.trim()) {
        localStorage.setItem('copilot_supabase_url', supabaseUrlInput.trim());
      } else {
        localStorage.removeItem('copilot_supabase_url');
      }

      if (supabaseKeyInput.trim()) {
        localStorage.setItem('copilot_supabase_key', supabaseKeyInput.trim());
      } else {
        localStorage.removeItem('copilot_supabase_key');
      }

      await checkHealth();
      addToast('success', 'Database Configuration Saved', 'Supabase parameters updated.');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    addToast('info', 'SQL Copied', 'Paste this into your Supabase SQL Editor.');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleExportJSON = () => {
    const fullBackup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      branding,
      products,
      suppliers,
      customers,
      purchaseOrders,
      salesOrders,
      cashbook,
      accounts,
      inventoryMovements
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pakerp_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Backup Exported', 'Downloaded complete database JSON snapshot.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.products) localStorage.setItem('copilot_products', JSON.stringify(parsed.products));
        if (parsed.suppliers) localStorage.setItem('copilot_suppliers', JSON.stringify(parsed.suppliers));
        if (parsed.customers) localStorage.setItem('copilot_customers', JSON.stringify(parsed.customers));
        if (parsed.purchaseOrders) localStorage.setItem('copilot_pos', JSON.stringify(parsed.purchaseOrders));
        if (parsed.salesOrders) localStorage.setItem('copilot_sales', JSON.stringify(parsed.salesOrders));
        if (parsed.cashbook) localStorage.setItem('copilot_cashbook', JSON.stringify(parsed.cashbook));
        if (parsed.accounts) localStorage.setItem('copilot_chart_of_accounts', JSON.stringify(parsed.accounts));
        if (parsed.inventoryMovements) localStorage.setItem('copilot_movements', JSON.stringify(parsed.inventoryMovements));
        if (parsed.branding) localStorage.setItem('copilot_branding', JSON.stringify(parsed.branding));

        syncDatabase();
        addToast('success', 'Backup Restored', 'Database state successfully restored from JSON file.');
      } catch (err: any) {
        addToast('error', 'Import Failed', 'Invalid JSON backup file format.');
      }
    };
    reader.readAsText(file);
  };

  // Provision User Form Submit
  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      addToast('error', 'Validation Error', 'Full Name and Corporate Email are required.');
      return;
    }

    setIsProvisioning(true);
    try {
      const res = await createUserAccount({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        password: newUserPassword.trim() || 'Welcome123!',
        phone: newUserPhone.trim()
      });

      if (res.success) {
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserPhone('');
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSaveUserEdit = async (userId: string) => {
    const updates: any = { role: editingRole };
    if (editingPassword.trim()) {
      updates.password = editingPassword.trim();
    }
    await updateUserAccount(userId, updates);
    setEditingUserId(null);
    setEditingPassword('');
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to revoke access and delete account for "${userName}"?`)) {
      await deleteUserAccount(userId);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Settings Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">System & Enterprise Settings</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supabase PostgreSQL cloud storage, User Accounts & RBAC, branding, and Groq AI configurations
            </p>
          </div>
        </div>

        {/* Setting Category Tabs */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'database' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase & Cloud DB</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Accounts & RBAC</span>
            {isSuperAdmin && (
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded font-bold">Admin</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'branding' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Company Branding</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Groq AI & Voice</span>
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'account' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Active Session</span>
          </button>
          <button
            onClick={() => setActiveTab('tax')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tax' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>FBR Tax Rules</span>
          </button>
        </div>
      </div>

      {/* 1. SUPABASE DATABASE & VERCEL CLOUD TAB */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Connection Status Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  <span>Supabase PostgreSQL Cloud Integration</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Production-grade cloud database persistence for multi-device sync, Vercel deployments, and transactional integrity.
                </p>
              </div>

              <button
                type="button"
                onClick={checkHealth}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>

            {/* Live Health Badge */}
            {dbHealth && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  dbHealth.status === 'connected'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : dbHealth.status === 'disconnected'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                }`}
              >
                {dbHealth.status === 'connected' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {dbHealth.status === 'connected'
                        ? 'Cloud Database Connected & Ready'
                        : dbHealth.status === 'disconnected'
                        ? 'Supabase Configured — Schema Pending'
                        : 'Local-First Storage Active'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/70 border border-current">
                      Status: {dbHealth.status}
                    </span>
                  </div>
                  <p className="leading-relaxed opacity-90">{dbHealth.message}</p>
                </div>
              </div>
            )}

            {/* Supabase Configuration Form — Super Admin only (PRD §40) */}
            {isSuperAdmin ? (
            <form onSubmit={handleSaveDatabaseConfig} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={supabaseUrlInput}
                    onChange={e => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-900"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Found in Supabase Dashboard &gt; Project Settings &gt; API
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Supabase Anon / Public API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSupabaseKey ? 'text' : 'password'}
                      value={supabaseKeyInput}
                      onChange={e => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showSupabaseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Public anon key for client-side queries and authentication
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Configured keys are saved in local client storage and utilized for all cloud operations.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingDb}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingDb ? 'Saving...' : 'Save Database Settings'}</span>
                </button>
              </div>
            </form>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Super Admin Access Required</span>
                  Database credentials can only be configured by a Super Administrator. For production deployments, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as environment variables in your hosting provider's project settings.
                </div>
              </div>
            )}
          </div>

          {/* Migration SQL Schema Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-indigo-600" />
                  <span>Production PostgreSQL DDL & RLS Security Script</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Run this DDL script in Supabase SQL Editor to provision all tables, relations, and RLS security policies.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopySql}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'SQL Script Copied!' : 'Copy SQL Schema'}</span>
              </button>
            </div>

            <div className="relative bg-slate-950 rounded-xl p-4 overflow-hidden">
              <pre className="font-mono text-xs text-emerald-400 overflow-x-auto max-h-64 leading-relaxed">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>

          {/* Backup & Snapshot Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-600" />
                <span>Backup & Offline Snapshot Export / Import</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Export and restore local offline database snapshots as JSON format.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Export Full Database Backup</span>
                  <span className="text-slate-500 text-[11px]">Downloads JSON archive of all tables</span>
                </div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export JSON</span>
                </button>
              </div>

              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Restore Database from Backup</span>
                  <span className="text-slate-500 text-[11px]">Uploads previously exported JSON</span>
                </div>
                <div>
                  <input
                    type="file"
                    ref={backupFileInputRef}
                    onChange={handleImportJSON}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Upload JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. USER ACCOUNTS & RBAC PROVISIONING TAB (Super Admin Only) */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Super Admin Notice if not authorized */}
          {!isSuperAdmin && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold block">Restricted Access</span>
                <span>User account creation, role assignment, and access revocation require Super Admin privileges.</span>
              </div>
            </div>
          )}

          {/* Provision New User Form (Super Admin only) */}
          {isSuperAdmin && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  <span>Provision New User Account</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only Super Administrators can provision corporate accounts. Users will authenticate with these credentials.
                </p>
              </div>

              <form onSubmit={handleProvisionUser} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={e => setNewUserName(e.target.value)}
                        placeholder="e.g. Tariq Mehmood"
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Corporate Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={e => setNewUserEmail(e.target.value)}
                        placeholder="tariq@company.com"
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Operational Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newUserRole}
                      onChange={e => setNewUserRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-semibold cursor-pointer"
                    >
                      <option value="Super Admin">Super Admin (All Privileges & Settings)</option>
                      <option value="Admin">Admin (Operations, Procurement & Sales)</option>
                      <option value="Head Accountant">Head Accountant (Treasury & Reports)</option>
                      <option value="Factory Supervisor">Factory Supervisor (Inventory & Procurement)</option>
                      <option value="Tax Auditor">Tax Auditor (Read-Only FBR Audits)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Initial Password
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newUserPassword}
                        onChange={e => setNewUserPassword(e.target.value)}
                        placeholder="Default: Welcome123!"
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-mono"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mobile / WhatsApp (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={newUserPhone}
                        onChange={e => setNewUserPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isProvisioning}
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      {isProvisioning ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>Provision User Account</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* User Directory Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Provisioned User Registry ({userAccounts.length})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage active users, modify operational roles, or revoke system access.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="px-4 py-3 rounded-l-xl">User & Contact</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-right rounded-r-xl">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userAccounts.map(user => {
                    const isSelf = currentUser?.id === user.id || currentUser?.email === user.email;
                    const isEditing = editingUserId === user.id;

                    const roleBadgeColor =
                      user.role === 'Super Admin'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : user.role === 'Admin'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : user.role === 'Head Accountant'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : user.role === 'Factory Supervisor'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-800 border-slate-200';

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
                              {user.phone && (
                                <div className="text-[10px] text-slate-400">{user.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editingRole}
                              onChange={e => setEditingRole(e.target.value as UserRole)}
                              className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-indigo-600"
                            >
                              <option value="Super Admin">Super Admin</option>
                              <option value="Admin">Admin</option>
                              <option value="Head Accountant">Head Accountant</option>
                              <option value="Factory Supervisor">Factory Supervisor</option>
                              <option value="Tax Auditor">Tax Auditor</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleBadgeColor}`}
                            >
                              {user.role}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                              user.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                            />
                            <span>{user.status === 'active' ? 'Active' : 'Suspended'}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Initial'}
                        </td>

                        {isSuperAdmin && (
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  type="text"
                                  placeholder="New password (optional)"
                                  value={editingPassword}
                                  onChange={e => setEditingPassword(e.target.value)}
                                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs outline-none w-36 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveUserEdit(user.id)}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingUserId(null)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUserId(user.id);
                                    setEditingRole(user.role);
                                    setEditingPassword('');
                                  }}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="Edit Role / Reset Password"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user.id, user.name)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Revoke & Delete User Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* RBAC Reference Guide */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Role-Based Access Control (RBAC) Governance Matrix</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                <span className="font-bold text-indigo-900 block">Super Admin</span>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Full unrestricted governance, user provisioning & role management, database schema migrations, and system settings.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
                <span className="font-bold text-indigo-900 block">Admin</span>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  Operational executive authority: manages inventory, purchasing, commercial sales, and financial records.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <span className="font-bold text-emerald-900 block">Head Accountant</span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Treasury, bank reconciliation, cashbook double-entry management, invoice dispatch, and financial reporting.
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                <span className="font-bold text-amber-900 block">Factory Supervisor</span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Warehouse stock receipts, inventory movements, dock dispatch, and purchase order drafting.
                </p>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">Tax Auditor</span>
                <p className="text-[11px] text-slate-700 leading-relaxed">
                  Read-only audit view for FBR compliance verification, tax ledger checks, and statutory reporting.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPANY BRANDING & LOGO */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>Company Identity & Custom Invoicing Header</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure your corporate logo, NTN, STRN, and legal business name rendered on all printed documents.
            </p>
          </div>

          <form onSubmit={handleSaveBranding} className="space-y-5 text-xs">
            {/* Logo Upload */}
            <div>
              <label className="block font-semibold text-slate-700 mb-2">Company Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {brandForm.logoBase64 ? (
                    <img src={brandForm.logoBase64} alt="Company Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-300" />
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Logo</span>
                    </button>
                    {brandForm.logoBase64 && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">Recommended: PNG or JPEG under 2MB</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Registered Name</label>
                <input
                  type="text"
                  required
                  value={brandForm.companyName}
                  onChange={e => setBrandForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tagline / Business Slogan</label>
                <input
                  type="text"
                  value={brandForm.tagline}
                  onChange={e => setBrandForm(prev => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">National Tax Number (NTN)</label>
                <input
                  type="text"
                  value={brandForm.ntnNumber}
                  onChange={e => setBrandForm(prev => ({ ...prev, ntnNumber: e.target.value }))}
                  placeholder="1234567-8"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sales Tax Registration (STRN)</label>
                <input
                  type="text"
                  value={brandForm.strnNumber}
                  onChange={e => setBrandForm(prev => ({ ...prev, strnNumber: e.target.value }))}
                  placeholder="03-00-1234-001-00"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Branding Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. GROQ AI & VOICE SETTINGS */}
      {activeTab === 'ai' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <span>Groq AI & Voice Transcription Engine</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Llama 3.3 70B business intelligence and Whisper Urdu/English voice processing run through this deployment's server-side AI proxy.
            </p>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-2.5">
            <Server className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900">
              <span className="font-bold block">Server-Side Key Security</span>
              The Groq API key is configured as an environment variable (GROQ_API_KEY) on the server and is never exposed to the browser — it cannot be read from DevTools, localStorage, or network traffic. Manage the key in your hosting provider's project settings.
            </div>
          </div>

          <form onSubmit={handleSaveAI} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supervisor LLM Model</label>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-slate-900"
                >
                  <option value="">Server Default — GPT-OSS 120B (Recommended)</option>
                  <option value="openai/gpt-oss-120b">GPT-OSS 120B (Highest Reasoning)</option>
                  <option value="openai/gpt-oss-20b">GPT-OSS 20B (Ultra Fast)</option>
                  <option value="qwen/qwen3.8-27b">Qwen 3.8 27B</option>
                  <option value="groq/compound">Groq Compound (Agentic)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Voice Transcriber Model</label>
                <input
                  type="text"
                  disabled
                  value="whisper-large-v3 (Urdu & English Multilingual)"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Test Connection Button & Result */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">Connection Health Check</span>
                  <span className="text-[11px] text-slate-500">Verifies the server-side AI proxy and key configuration</span>
                </div>
                <button
                  type="button"
                  onClick={handleTestGroq}
                  disabled={testingGroq}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingGroq ? 'animate-spin' : ''}`} />
                  <span>{testingGroq ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className="font-bold">{testResult.message}</span>
                    {testResult.latencyMs && (
                      <span className="ml-2 font-mono text-[10px] opacity-75">
                        ({testResult.latencyMs}ms latency)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Model Configuration</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. ACTIVE USER SESSION */}
      {activeTab === 'account' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <span>Active User Profile & Session</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enterprise role privileges and security governance policies.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-semibold text-slate-500 block">Authenticated User</span>
                <span className="font-bold text-slate-900 text-sm block">{currentUser?.name || 'Administrator'}</span>
                <span className="font-mono text-slate-600 text-xs">{currentUser?.email}</span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-semibold text-slate-500 block">Assigned Role & Privilege Tier</span>
                <span className="font-bold text-indigo-700 text-sm block">{currentUser?.role || 'Super Admin'}</span>
                <span className="text-slate-500 text-xs">
                  {currentUser?.permissions?.canManageUsers ? 'Super Admin (Full RBAC Management)' : 'Standard Operator'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">Current Session Security</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  User ID: {currentUser?.id} • Active Status: Verified
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FBR TAX DEFAULTS & FACTORY RESET */}
      {activeTab === 'tax' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800/90 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-700" />
              <span>FBR Statutory Rules & Database Controls</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Governed statutory rates under Pakistan Sales Tax Act 1990 and Income Tax Ordinance 2001.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-800 block">Sales Tax Act 1990 Section 3(1)</span>
                <span className="text-2xl font-black font-mono text-indigo-700 mt-1 block">18.00%</span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Deterministic GST computed on all commercial dispatches.
                </span>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-800 block">Section 153 Active Taxpayer WHT</span>
                <span className="text-2xl font-black font-mono text-indigo-700 mt-1 block">4.50%</span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Withholding deduction on supplies made by corporate companies.
                </span>
              </div>
            </div>

            {/* Factory Reset */}
            {isSuperAdmin && (
              <div className="p-5 border border-red-200 bg-red-50/50 rounded-2xl space-y-3">
                <div>
                  <span className="font-bold text-red-900 text-sm block">Factory Database Purge & Clean Reset</span>
                  <span className="text-[11px] text-red-700 leading-relaxed block mt-0.5">
                    Cleans all transactional records (sales, purchases, vouchers, stock movements) and prepares clean zero-balance production state.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to purge all transactions and reset to clean production baseline?')) {
                      resetAllData();
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset to Clean Production Baseline</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
