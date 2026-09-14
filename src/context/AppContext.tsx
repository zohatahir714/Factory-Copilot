/**
 * AI Business Copilot - Central Operational State & Multi-Agent Context
 * Compliant with PRD Section 1, 2, 7, 8, 9, 11, 14 & 17
 * Enhanced with Auth, Custom Branding, Groq AI Configuration, and Full CRUD Operations
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Organization,
  Profile,
  Product,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesOrder,
  InventoryMovement,
  CashbookEntry,
  ComplianceRAGSource,
  ChatMessage,
  ConfirmationPayload,
  AuthUser,
  UserAccount,
  UserRole,
  RolePermissions,
  BrandingSettings,
  AISettings,
  ViewableItemType,
  EditableItemType,
  PrintDocumentPayload,
  ChartOfAccount,
  VoucherLineItem,
  VoucherType
} from '../types';
import {
  SEED_ORGANIZATION,
  SEED_PROFILE,
  SEED_COMPLIANCE_SOURCES
} from '../data/seedData';
import {
  LIVE_PRODUCTS,
  LIVE_SUPPLIERS,
  LIVE_CUSTOMERS,
  LIVE_INITIAL_POS,
  LIVE_INITIAL_SALES,
  LIVE_INITIAL_MOVEMENTS
} from '../data/liveInventoryData';
import {
  INITIAL_CHART_OF_ACCOUNTS,
  INITIAL_CASHBOOK_VOUCHERS
} from '../data/accountingData';
import { calculateLiquidTreasury } from '../utils/accountingEngine';
import {
  DatabaseState,
  executeCreatePurchaseOrder,
  executeRecordSale,
  toolReceiveGoods,
  prepareReorderLowStockConfirmation
} from '../lib/businessTools';
import { executeSupervisorTurn } from '../lib/agentSupervisor';
import {
  queryGroqChat,
  transcribeWithGroqWhisper,
  speakVoiceResponse
} from '../lib/groqClient';
import {
  getSupabaseClient,
  getSupabaseConfig,
  supabaseSignUp,
  supabaseSignOut,
  fetchSupabaseProfiles,
  updateSupabaseProfile,
  deleteSupabaseProfile
} from '../supabaseClient';

export type AppTab =
  | 'dashboard'
  | 'compliance'
  | 'fbr_integration'
  | 'inventory'
  | 'purchase'
  | 'suppliers'
  | 'sales'
  | 'customers'
  | 'cashbook'
  | 'reports'
  | 'movements'
  | 'copilot'
  | 'settings';

export type ActiveModal = 'none' | 'product' | 'purchase' | 'sale' | 'expense' | 'compliance' | 'voice' | 'supplier' | 'customer' | 'account';

export interface ToastAlert {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

export const getRolePermissions = (role: UserRole): RolePermissions => {
  switch (role) {
    case 'Super Admin':
      return {
        canManageUsers: true,
        canDeleteRecords: true,
        canEditSettings: true,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Admin':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Head Accountant':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: false,
        canManageProcurement: false,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Factory Supervisor':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: false,
        canManageCashbook: false,
        canPrintDocuments: true
      };
    case 'Tax Auditor':
    default:
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: false,
        canManageProcurement: false,
        canManageSalesAndTax: false,
        canManageCashbook: false,
        canPrintDocuments: true
      };
  }
};

// Clean wipe check for production state with zero demo seed data.
// v7: also purges any Groq API key previously stored in the browser —
// keys are server-side only now (PRD §40).
if (typeof window !== 'undefined') {
  if (localStorage.getItem('copilot_clean_v7') !== 'true') {
    localStorage.removeItem('copilot_products');
    localStorage.removeItem('copilot_pos');
    localStorage.removeItem('copilot_sales');
    localStorage.removeItem('copilot_movements');
    localStorage.removeItem('copilot_cashbook');
    localStorage.removeItem('copilot_customers');
    localStorage.removeItem('copilot_suppliers');
    localStorage.removeItem('copilot_auth_user');
    localStorage.removeItem('copilot_groq_key');
    localStorage.setItem('copilot_clean_v7', 'true');
  }
}

// ============================================================================
// SESSION IDLE TIMEOUT (PRD §8 Security Model)
// A signed-in user is signed out after this much inactivity and lands back on
// the login screen with an expiry notice. Real user interaction resets the
// idle clock. Supabase Auth remains the owner of the underlying session.
// ============================================================================
export const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes — auto-logout policy

interface AppContextType {
  // Navigation
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;

  // Global Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Auth & Session (Role-Based Access Control & Supabase Auth)
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => boolean;
  logout: () => void;
  setAuthUser: (user: AuthUser) => void;
  sessionExpired: boolean;

  // User Accounts Management (Super Admin Exclusive)
  userAccounts: UserAccount[];
  createUserAccount: (data: { name: string; email: string; role: UserRole; password?: string; phone?: string }) => Promise<{ success: boolean; message: string }>;
  updateUserAccount: (id: string, updates: Partial<UserAccount>) => Promise<{ success: boolean; message: string }>;
  deleteUserAccount: (id: string) => Promise<{ success: boolean; message: string }>;

  // Branding Settings (Local Storage Powered)
  branding: BrandingSettings;
  brandingSettings: BrandingSettings;
  updateBranding: (newBranding: Partial<BrandingSettings>) => void;

  // AI & Groq API Settings
  aiSettings: AISettings;
  updateAISettings: (newSettings: Partial<AISettings>) => void;

  // Modals / Forms
  activeModal: ActiveModal;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;

  // View, Edit & Delete Unified Modals
  viewingItem: { type: ViewableItemType; data: any } | null;
  openViewModal: (type: ViewableItemType, data: any) => void;
  closeViewModal: () => void;

  editingItem: { type: EditableItemType; data: any } | null;
  openEditModal: (type: EditableItemType, data: any) => void;
  closeEditModal: () => void;

  deletingItem: { type: EditableItemType; id: string; name: string } | null;
  openDeleteModal: (type: EditableItemType, id: string, name: string) => void;
  closeDeleteModal: () => void;
  confirmDeleteItem: () => void;

  // Printable Document Preview
  printDocument: PrintDocumentPayload | null;
  openPrintDocument: (payloadOrType: PrintDocumentPayload | any, maybeData?: any, maybeTitle?: string) => void;
  closePrintDocument: () => void;

  // Business DB State
  organization: Organization;
  profile: Profile;
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  inventoryMovements: InventoryMovement[];
  cashbook: CashbookEntry[];
  accounts: ChartOfAccount[];
  complianceSources: ComplianceRAGSource[];

  // Treasury & Liquidity Metrics
  cashInHand: number;
  bankBalance: number;
  totalLiquidity: number;

  // CRUD Operations
  createProductDirect: (data: Omit<Product, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updated: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  createPurchaseOrderDirect: (data: { supplierId: string; productId: string; quantity: number }) => void;
  updatePurchaseOrder: (id: string, updated: Partial<PurchaseOrder>) => void;
  deletePurchaseOrder: (id: string) => void;

  recordSaleDirect: (data: {
    customerId: string;
    productId: string;
    quantity: number;
    subtotal?: number;
    taxRate?: number;
    taxAmount?: number;
    totalAmount?: number;
    taxCategory?: string;
    buyerNTN?: string;
    buyerCNIC?: string;
    isFiler?: boolean;
  }) => void;
  updateSalesOrder: (id: string, updated: Partial<SalesOrder>) => void;
  deleteSalesOrder: (id: string) => void;

  recordExpenseDirect: (data: { amount: number; category: string; description: string; type?: 'inflow' | 'outflow' }) => void;
  createVoucherDirect: (voucher: {
    voucherType: VoucherType;
    paymentMode?: 'cash' | 'bank' | 'journal';
    bankAccountId?: string;
    bankAccountName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    description: string;
    category?: string;
    amount?: number;
    voucherDate?: string;
    entries: VoucherLineItem[];
    preparedBy?: string;
    approvedBy?: string;
  }) => void;
  updateCashbookEntry: (id: string, updated: Partial<CashbookEntry>) => void;
  deleteCashbookEntry: (id: string) => void;

  // Chart of Accounts CRUD
  addAccount: (data: Omit<ChartOfAccount, 'id' | 'organizationId' | 'createdAt'>) => void;
  updateAccount: (id: string, updated: Partial<ChartOfAccount>) => void;
  deleteAccount: (id: string) => void;

  createSupplierDirect: (data: Omit<Supplier, 'id' | 'organizationId' | 'createdAt'>) => void;
  updateSupplier: (id: string, updated: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  createCustomerDirect: (data: Omit<Customer, 'id' | 'organizationId' | 'createdAt'>) => void;
  updateCustomer: (id: string, updated: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;


  // Conversation & Multi-Agent State
  messages: ChatMessage[];
  isProcessing: boolean;
  activeConfirmation: ConfirmationPayload | null;

  // Actions
  sendMessage: (content: string, method?: 'text' | 'voice') => void;
  confirmAction: (payload: ConfirmationPayload) => void;
  cancelAction: (payloadId: string) => void;
  quickReceivePO: (poNumber: string) => void;
  resetAllData: () => void;

  // Voice Interaction & Real Speech
  isRecording: boolean;
  isTranscribing: boolean;
  recordingTranscript: string;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  setRecordingTranscript: (text: string) => void;
  audioVoiceEnabled: boolean;
  toggleAudioVoice: () => void;
  speakText: (text: string) => void;
  micErrorNotice: string | null;
  clearMicErrorNotice: () => void;
  requestMicrophonePermission: () => Promise<boolean>;

  // Real Inventory & Reorder Operations
  fetchLiveInventoryData: (forceReload?: boolean) => void;
  reorderProduct: (productNameOrSku: string, customQty?: number) => void;
  reorderAllLowStock: () => void;

  // Quick prompt trigger
  triggerDemoPrompt: (prompt: string, method?: 'text' | 'voice') => void;

  // Notifications
  notifications: ToastAlert[];
  dismissNotification: (id: string) => void;
  addToast: (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => void;

  // Theme & Data Sync
  darkMode: boolean;
  toggleDarkMode: () => void;
  syncDatabase: () => void;
  syncTimestamp: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_BRANDING: BrandingSettings = {
  companyName: 'Industrial Manufacturing Solutions',
  tagline: 'Enterprise SME Operating System',
  ntnNumber: '1234567-8',
  strnNumber: '03-00-1234-001-00',
  city: 'Lahore, Pakistan',
  logoBase64: ''
};

const DEFAULT_AI_SETTINGS: AISettings = {
  selectedModel: '',
  whisperModel: 'whisper-large-v3',
  systemLanguage: 'both'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModal, setActiveModal] = useState<ActiveModal>('none');

  // Auth State: Role-Based Access Control & Supabase Cloud Auth
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('copilot_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.email) {
          const role = parsed.role || 'Super Admin';
          return {
            id: parsed.id || 'usr_admin',
            email: parsed.email,
            name: parsed.name || parsed.email.split('@')[0],
            role: role as UserRole,
            permissions: getRolePermissions(role as UserRole),
            avatarUrl: parsed.avatarUrl
          };
        }
      } catch (e) {}
    }
    return null; // Require login screen authentication
  });
  const isAuthenticated = currentUser !== null;

  // Idle-session state: true after the timeout force-signs the user out,
  // consumed by LoginScreen to show the "Session expired" notice.
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const lastActivityRef = React.useRef<number>(Date.now());

  // Default Root & Super Admin accounts
  const DEFAULT_SUPER_ADMINS: UserAccount[] = [
    {
      id: 'usr_adil_superadmin',
      email: 'adil@gmail.com',
      name: 'Adil (Super Admin)',
      role: 'Super Admin',
      password: 'adil123',
      status: 'active',
      phone: '+92 300 1234567',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_root_admin',
      email: 'admin@pakerp.com',
      name: 'Super Administrator',
      role: 'Super Admin',
      password: 'admin',
      status: 'active',
      phone: '+92 300 0000000',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_system_owner',
      email: 'learnthetechfirst@gmail.com',
      name: 'System Owner (Super Admin)',
      role: 'Super Admin',
      password: 'admin',
      status: 'active',
      phone: '+92 300 9999999',
      createdAt: new Date().toISOString()
    }
  ];

  // User Accounts State (Managed exclusively by Super Admin in Settings module)
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('copilot_registered_users');
    let loadedAccounts: UserAccount[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedAccounts = parsed;
        }
      } catch (e) {}
    }

    // Merge default super admins so they are always guaranteed to exist
    const merged = [...loadedAccounts];
    DEFAULT_SUPER_ADMINS.forEach(defAdmin => {
      const existingIdx = merged.findIndex(u => u.email.toLowerCase() === defAdmin.email.toLowerCase());
      if (existingIdx === -1) {
        merged.push(defAdmin);
      } else {
        // Ensure password and Super Admin role are up to date
        merged[existingIdx] = {
          ...merged[existingIdx],
          role: 'Super Admin',
          status: 'active',
          password: merged[existingIdx].password || defAdmin.password
        };
      }
    });

    localStorage.setItem('copilot_registered_users', JSON.stringify(merged));
    return merged;
  });

  const saveUserAccounts = (accounts: UserAccount[]) => {
    setUserAccounts(accounts);
    localStorage.setItem('copilot_registered_users', JSON.stringify(accounts));
  };

  const createUserAccount = async (data: {
    name: string;
    email: string;
    role: UserRole;
    password?: string;
    phone?: string;
  }): Promise<{ success: boolean; message: string }> => {
    const trimmedEmail = data.email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { success: false, message: 'Corporate email address is required.' };
    }
    if (userAccounts.some(u => u.email.toLowerCase() === trimmedEmail)) {
      return { success: false, message: `An account with email "${trimmedEmail}" already exists.` };
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      email: trimmedEmail,
      name: data.name.trim(),
      role: data.role,
      password: data.password?.trim() || 'Welcome123!',
      phone: data.phone?.trim() || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // If Supabase Cloud Auth is configured, also provision on Supabase
    const { isConfigured } = getSupabaseConfig();
    if (isConfigured) {
      try {
        await supabaseSignUp({
          email: newUser.email,
          password: newUser.password || 'Welcome123!',
          fullName: newUser.name,
          role: newUser.role,
          phone: newUser.phone,
          companyName: branding.companyName
        });
      } catch (err) {
        console.warn('Supabase cloud provisioning note:', err);
      }
    }

    const updated = [newUser, ...userAccounts];
    saveUserAccounts(updated);
    addToast('success', 'User Account Provisioned', `Created ${newUser.name} with ${newUser.role} privileges.`);
    return { success: true, message: `Account created for ${newUser.name} (${newUser.role}).` };
  };

  const updateUserAccount = async (id: string, updates: Partial<UserAccount>): Promise<{ success: boolean; message: string }> => {
    const updated = userAccounts.map(u => {
      if (u.id === id) {
        return { ...u, ...updates };
      }
      return u;
    });
    saveUserAccounts(updated);

    // Sync to Supabase profiles table if configured
    const { isConfigured } = getSupabaseConfig();
    if (isConfigured) {
      try {
        await updateSupabaseProfile(id, {
          full_name: updates.name,
          role: updates.role,
          phone: updates.phone,
          status: updates.status
        });
      } catch (err) {
        console.warn('Supabase profile update warning:', err);
      }
    }

    if (currentUser && currentUser.id === id) {
      const target = updated.find(u => u.id === id);
      if (target) {
        const newAuth: AuthUser = {
          id: target.id,
          email: target.email,
          name: target.name,
          role: target.role,
          permissions: getRolePermissions(target.role)
        };
        setAuthUser(newAuth);
      }
    }

    addToast('success', 'Account Updated', 'User privileges updated successfully.');
    return { success: true, message: 'User updated.' };
  };

  const deleteUserAccount = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (currentUser?.id === id) {
      addToast('error', 'Action Denied', 'You cannot delete your own active administrative session.');
      return { success: false, message: 'Cannot delete current logged-in user.' };
    }

    // Delete from Supabase profiles table if configured
    const { isConfigured } = getSupabaseConfig();
    if (isConfigured) {
      try {
        await deleteSupabaseProfile(id);
      } catch (err) {
        console.warn('Supabase profile deletion warning:', err);
      }
    }

    const updated = userAccounts.filter(u => u.id !== id);
    saveUserAccounts(updated);
    addToast('info', 'Account Revoked', 'User account has been deleted.');
    return { success: true, message: 'User deleted successfully.' };
  };

  const setAuthUser = (user: AuthUser) => {
    setSessionExpired(false);
    setCurrentUser(user);
    localStorage.setItem('copilot_auth_user', JSON.stringify(user));
  };

  const login = (email: string, password?: string): boolean => {
    setSessionExpired(false);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = (password || '').trim();

    if (!trimmedEmail) {
      addToast('error', 'Authentication Required', 'Please enter your registered email address.');
      return false;
    }

    // 1. Check registered user accounts registry — exact credential match required.
    //    Empty passwords never authenticate, and no universal master password exists.
    const match = userAccounts.find(
      u => u.email.toLowerCase() === trimmedEmail && !!u.password && u.password === trimmedPassword
    );

    if (match) {
      if (match.status === 'suspended') {
        addToast('error', 'Account Suspended', 'This account has been deactivated by the Super Administrator.');
        return false;
      }
      const authUser: AuthUser = {
        id: match.id,
        email: match.email,
        name: match.name,
        role: match.role,
        permissions: getRolePermissions(match.role)
      };
      setCurrentUser(authUser);
      localStorage.setItem('copilot_auth_user', JSON.stringify(authUser));
      addToast('success', 'Authenticated', `Welcome, ${authUser.name} (${authUser.role})`);
      return true;
    }

    // 2. Resilient Super Admin verification for master accounts —
    //    only consulted when the account is not already in the registry, and
    //    each master account accepts only its own documented password.
    const knownAccount = userAccounts.some(u => u.email.toLowerCase() === trimmedEmail);
    const defAdmin = !knownAccount
      ? DEFAULT_SUPER_ADMINS.find(
          d => d.email.toLowerCase() === trimmedEmail && !!d.password && d.password === trimmedPassword
        )
      : undefined;

    if (defAdmin) {
      const authUser: AuthUser = {
        id: defAdmin.id,
        email: defAdmin.email,
        name: defAdmin.name,
        role: 'Super Admin',
        permissions: getRolePermissions('Super Admin')
      };
      // Upsert into user accounts list
      const updated = [defAdmin, ...userAccounts.filter(u => u.email.toLowerCase() !== defAdmin.email.toLowerCase())];
      saveUserAccounts(updated);

      setCurrentUser(authUser);
      localStorage.setItem('copilot_auth_user', JSON.stringify(authUser));
      addToast('success', 'Authenticated as Super Admin', `Welcome, ${authUser.name}`);
      return true;
    }

    addToast('error', 'Authentication Failed', 'Invalid email or password. Please verify credentials or contact Super Admin.');
    return false;
  };

  const logout = () => {
    setSessionExpired(false);
    setCurrentUser(null);
    localStorage.removeItem('copilot_auth_user');
    supabaseSignOut().catch(() => {});
    addToast('info', 'Logged Out', 'Your session has been ended safely.');
  };

  // Idle session timeout watcher (PRD §8): sign the user out after
  // SESSION_IDLE_TIMEOUT_MS with no real interaction. Pointer, key, wheel,
  // and touch activity reset the idle clock. Supabase Auth stays the session
  // owner — this only ends the app-level session.
  useEffect(() => {
    if (!isAuthenticated) return;

    const bumpActivity = () => { lastActivityRef.current = Date.now(); };
    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    activityEvents.forEach(e => window.addEventListener(e, bumpActivity, { passive: true }));

    const idleCheck = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= SESSION_IDLE_TIMEOUT_MS) {
        setSessionExpired(true);
        setCurrentUser(null);
        localStorage.removeItem('copilot_auth_user');
        supabaseSignOut().catch(() => {});
      }
    }, 2 * 1000);

    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, bumpActivity));
      window.clearInterval(idleCheck);
    };
  }, [isAuthenticated]);

  // Sync Supabase Auth Session on Mount
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.getSession().then(({ data }) => {
      if (data?.session?.user && !currentUser) {
        const u = data.session.user;
        const role = (u.user_metadata?.role as UserRole) || 'Super Admin';
        const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'User';
        const authUser: AuthUser = {
          id: u.id,
          email: u.email || '',
          name,
          role,
          permissions: getRolePermissions(role)
        };
        setCurrentUser(authUser);
        localStorage.setItem('copilot_auth_user', JSON.stringify(authUser));
      }
    }).catch(() => {});

    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem('copilot_auth_user');
      } else if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        const u = session.user;
        const role = (u.user_metadata?.role as UserRole) || 'Super Admin';
        const name = u.user_metadata?.full_name || u.email?.split('@')[0] || 'User';
        const authUser: AuthUser = {
          id: u.id,
          email: u.email || '',
          name,
          role,
          permissions: getRolePermissions(role)
        };
        setCurrentUser(authUser);
        localStorage.setItem('copilot_auth_user', JSON.stringify(authUser));
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Theme Management (Default Light Mode with Dark Mode Support)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('copilot_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('copilot_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Database Synchronization state
  const [syncTimestamp, setSyncTimestamp] = useState<number>(Date.now());

  const syncDatabase = () => {
    try {
      const p = localStorage.getItem('copilot_products');
      if (p) setProducts(JSON.parse(p));
      const pos = localStorage.getItem('copilot_pos');
      if (pos) setPurchaseOrders(JSON.parse(pos));
      const so = localStorage.getItem('copilot_sales');
      if (so) setSalesOrders(JSON.parse(so));
      const cb = localStorage.getItem('copilot_cashbook');
      if (cb) setCashbook(JSON.parse(cb));
      const mov = localStorage.getItem('copilot_movements');
      if (mov) setInventoryMovements(JSON.parse(mov));
      const cust = localStorage.getItem('copilot_customers');
      if (cust) setCustomers(JSON.parse(cust));
    } catch (e) {}
    setSyncTimestamp(Date.now());
  };

  // Branding State (from Local Storage)
  const [branding, setBranding] = useState<BrandingSettings>(() => {
    const saved = localStorage.getItem('copilot_branding');
    return saved ? { ...DEFAULT_BRANDING, ...JSON.parse(saved) } : DEFAULT_BRANDING;
  });

  const updateBranding = (newBranding: Partial<BrandingSettings>) => {
    setBranding(prev => {
      const updated = { ...prev, ...newBranding };
      localStorage.setItem('copilot_branding', JSON.stringify(updated));
      return updated;
    });
    addToast('success', 'Branding Updated', 'Custom brand settings and logo saved to local storage.');
  };

  // AI & Groq API Settings (from Local Storage)
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('copilot_ai_settings');
    return saved ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AI_SETTINGS;
  });

  const updateAISettings = (newSettings: Partial<AISettings>) => {
    setAiSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('copilot_ai_settings', JSON.stringify(updated));
      return updated;
    });
    addToast('success', 'AI Settings Saved', 'Model preferences stored. The API key remains server-side.');
  };

  // Unified Inspection, Editing, and Deletion Modals
  const [viewingItem, setViewingItem] = useState<{ type: ViewableItemType; data: any } | null>(null);
  const openViewModal = (type: ViewableItemType, data: any) => setViewingItem({ type, data });
  const closeViewModal = () => setViewingItem(null);

  const [editingItem, setEditingItem] = useState<{ type: EditableItemType; data: any } | null>(null);
  const openEditModal = (type: EditableItemType, data: any) => setEditingItem({ type, data });
  const closeEditModal = () => setEditingItem(null);

  const [deletingItem, setDeletingItem] = useState<{ type: EditableItemType; id: string; name: string } | null>(null);
  const openDeleteModal = (type: EditableItemType, id: string, name: string) => setDeletingItem({ type, id, name });
  const closeDeleteModal = () => setDeletingItem(null);

  // Printing State
  const [printDocument, setPrintDocument] = useState<PrintDocumentPayload | null>(null);
  const openPrintDocument = (payloadOrType: any, maybeData?: any, maybeTitle?: string) => {
    if (typeof payloadOrType === 'string') {
      setPrintDocument({
        type: payloadOrType as any,
        title: maybeTitle || (payloadOrType === 'invoice' ? 'Sales Tax Invoice' : payloadOrType === 'purchase_order' ? 'Purchase Order' : 'Cash Voucher'),
        data: maybeData || {}
      });
    } else if (payloadOrType && typeof payloadOrType === 'object') {
      setPrintDocument({
        type: payloadOrType.type || 'cash_voucher',
        title: payloadOrType.title || 'Document',
        data: payloadOrType.data ?? {}
      });
    } else {
      setPrintDocument(null);
    }
  };
  const closePrintDocument = () => setPrintDocument(null);

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);
  const openModal = (modal: ActiveModal) => setActiveModal(modal);
  const closeModal = () => setActiveModal('none');

  // Live Manufacturing Database State with LocalStorage resilience
  const [organization] = useState<Organization>(SEED_ORGANIZATION);
  const [profile] = useState<Profile>(SEED_PROFILE);

  const [products, setProducts] = useState<Product[]>(() => {
    const s = localStorage.getItem('copilot_products');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return LIVE_PRODUCTS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const s = localStorage.getItem('copilot_suppliers');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return LIVE_SUPPLIERS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const s = localStorage.getItem('copilot_customers');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return LIVE_CUSTOMERS;
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const s = localStorage.getItem('copilot_pos');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return LIVE_INITIAL_POS;
  });

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(() => {
    const s = localStorage.getItem('copilot_sales');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return LIVE_INITIAL_SALES;
  });

  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => {
    const s = localStorage.getItem('copilot_movements');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return LIVE_INITIAL_MOVEMENTS;
  });

  const [accounts, setAccounts] = useState<ChartOfAccount[]>(() => {
    const s = localStorage.getItem('copilot_chart_of_accounts');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_CHART_OF_ACCOUNTS;
  });

  const [cashbook, setCashbook] = useState<CashbookEntry[]>(() => {
    const s = localStorage.getItem('copilot_cashbook');
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_CASHBOOK_VOUCHERS;
  });

  // Calculate live real-time Cash in Hand & Bank Balances from accounting engine
  const { cashInHand, bankBalance, totalLiquidity } = calculateLiquidTreasury(accounts, cashbook);

  const [complianceSources] = useState<ComplianceRAGSource[]>(SEED_COMPLIANCE_SOURCES);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('copilot_products', JSON.stringify(products));
  }, [products]);
  useEffect(() => {
    localStorage.setItem('copilot_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);
  useEffect(() => {
    localStorage.setItem('copilot_customers', JSON.stringify(customers));
  }, [customers]);
  useEffect(() => {
    localStorage.setItem('copilot_pos', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);
  useEffect(() => {
    localStorage.setItem('copilot_sales', JSON.stringify(salesOrders));
  }, [salesOrders]);
  useEffect(() => {
    localStorage.setItem('copilot_movements', JSON.stringify(inventoryMovements));
  }, [inventoryMovements]);
  useEffect(() => {
    localStorage.setItem('copilot_cashbook', JSON.stringify(cashbook));
  }, [cashbook]);
  useEffect(() => {
    localStorage.setItem('copilot_chart_of_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // Notifications with strict 2-second auto-hide
  const [notifications, setNotifications] = useState<ToastAlert[]>([]);
  const addToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast: ToastAlert = { id, type, title, message };
    setNotifications(prev => [newToast, ...prev.slice(0, 4)]);
    // Auto-hide popup after 2 seconds per requirement
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2000);
  };
  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Chat & Multi-Agent state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `Assalam-o-Alaikum! Main aapka **Industrial AI Copilot & FBR Compliance Supervisor** hoon.

Aap mujhse Roman Urdu ya English mein bol kar koi bhi entry ya live factory report le saktay hain:
- *"Kitna dye aur yarn bacha hai?"*
- *"ColorChem se 100 kilo blue dye ka PO bana do"*
- *"Al-Rehman ko 50 kilo cotton yarn sell karo (18% GST auto-applied)"*
- *"Aaj ka complete business summary do"*

System deterministic business tools aur FBR Tax Laws ke mutabiq chal raha hai.`,
      timestamp: new Date().toISOString(),
      routedAgent: 'supervisor'
    }
  ]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeConfirmation, setActiveConfirmation] = useState<ConfirmationPayload | null>(null);

  // Real Voice & Groq Whisper state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [recordingTranscript, setRecordingTranscript] = useState<string>('');
  const [audioVoiceEnabled, setAudioVoiceEnabled] = useState<boolean>(true);
  const [micErrorNotice, setMicErrorNotice] = useState<string | null>(null);
  const clearMicErrorNotice = () => setMicErrorNotice(null);
  const toggleAudioVoice = () => setAudioVoiceEnabled(prev => !prev);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

  const getDBState = (): DatabaseState => ({
    products,
    suppliers,
    customers,
    purchaseOrders,
    salesOrders,
    cashbook,
    inventoryMovements,
    complianceSources
  });

  const applyDatabaseUpdate = (update: Partial<DatabaseState>) => {
    if (update.products) setProducts(update.products);
    if (update.purchaseOrders) setPurchaseOrders(update.purchaseOrders);
    if (update.salesOrders) setSalesOrders(update.salesOrders);
    if (update.cashbook) setCashbook(update.cashbook);
    if (update.inventoryMovements) setInventoryMovements(update.inventoryMovements);
    if (update.customers) setCustomers(update.customers);
  };

  // CRUD Operations Implementation
  const createProductDirect = (data: Omit<Product, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => {
    // Strict compliance rule: Inventory can only be added through an approved Purchase Order
    const newProduct: Product = {
      ...data,
      currentStock: 0,
      id: `prod_${Date.now()}`,
      organizationId: organization.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setProducts(prev => [newProduct, ...prev]);
    closeModal();
    addToast('success', 'Product Registered', `${newProduct.name} (SKU: ${newProduct.sku}) added with 0 initial stock. Issue and receive a Purchase Order to restock inventory.`);
  };

  const updateProduct = (id: string, updated: Partial<Product>) => {
    // Enforce: currentStock cannot be manually overwritten; must go through PO receiving or sales dispatch
    const { currentStock: _lockedStock, ...allowedUpdates } = updated as any;
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...allowedUpdates, updatedAt: new Date().toISOString() } : p)));
    closeEditModal();
    addToast('success', 'Product Updated', 'Changes saved successfully.');
  };

  const deleteProduct = (id: string) => {
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin (adil@gmail.com) can delete items.');
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    closeDeleteModal();
    addToast('info', 'Product Removed', 'Item deleted from inventory catalog.');
  };

  const createPurchaseOrderDirect = (data: { supplierId: string; productId: string; quantity: number }) => {
    const supplier = suppliers.find(s => s.id === data.supplierId) || suppliers[0];
    const product = products.find(p => p.id === data.productId) || products[0];
    const unitPrice = product?.costPrice || 500;
    const totalAmount = unitPrice * data.quantity;

    const res = executeCreatePurchaseOrder(getDBState(), {
      supplierId: supplier.id,
      supplierName: supplier.name,
      productId: product.id,
      productName: product.name,
      quantity: data.quantity,
      unit: product.unit,
      unitPrice,
      totalAmount
    });
    applyDatabaseUpdate(res.updatedState);
    closeModal();
    addToast('success', 'Purchase Order Issued', `${res.newPo.poNumber} committed for Rs. ${res.newPo.totalAmount.toLocaleString()}`);
  };

  const updatePurchaseOrder = (id: string, updated: Partial<PurchaseOrder>) => {
    setPurchaseOrders(prev => prev.map(po => (po.id === id ? { ...po, ...updated } : po)));
    closeEditModal();
    addToast('success', 'PO Updated', 'Purchase Order details updated.');
  };

  const deletePurchaseOrder = (id: string) => {
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin (adil@gmail.com) can delete purchase orders.');
      return;
    }
    setPurchaseOrders(prev => prev.filter(po => po.id !== id));
    closeDeleteModal();
    addToast('info', 'PO Deleted', 'Purchase Order cancelled and deleted.');
  };

  const recordSaleDirect = (data: {
    customerId: string;
    productId: string;
    quantity: number;
    subtotal?: number;
    taxRate?: number;
    taxAmount?: number;
    totalAmount?: number;
    taxCategory?: string;
    buyerNTN?: string;
    buyerCNIC?: string;
    isFiler?: boolean;
  }) => {
    const customer = customers.find(c => c.id === data.customerId) || customers[0];
    const product = products.find(p => p.id === data.productId) || products[0];
    const unitPrice = product?.sellingPrice || 600;
    const subtotal = data.subtotal !== undefined ? data.subtotal : unitPrice * data.quantity;
    const taxRate = data.taxRate !== undefined ? data.taxRate : 18;
    const taxAmount = data.taxAmount !== undefined ? data.taxAmount : Math.round((subtotal * taxRate) / 100);
    const totalAmount = data.totalAmount !== undefined ? data.totalAmount : subtotal + taxAmount;

    const res = executeRecordSale(getDBState(), {
      customerId: customer.id,
      customerName: customer.name,
      productId: product.id,
      productName: product.name,
      quantity: data.quantity,
      unit: product.unit,
      unitPrice,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount
    });
    applyDatabaseUpdate(res.updatedState);
    closeModal();
    addToast('success', `Sale Invoiced (${taxRate}% FBR Tax)`, `${res.newInvoice.invoiceNumber} recorded. Total: Rs. ${res.newInvoice.totalAmount.toLocaleString()}`);
  };

  const updateSalesOrder = (id: string, updated: Partial<SalesOrder>) => {
    setSalesOrders(prev => prev.map(so => (so.id === id ? { ...so, ...updated } : so)));
    closeEditModal();
    addToast('success', 'Invoice Updated', 'Sales invoice records updated.');
  };

  const deleteSalesOrder = (id: string) => {
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin (adil@gmail.com) can delete sales invoices.');
      return;
    }
    setSalesOrders(prev => prev.filter(so => so.id !== id));
    closeDeleteModal();
    addToast('info', 'Invoice Deleted', 'Sales record deleted.');
  };

  const recordExpenseDirect = (data: { amount: number; category: string; description: string; type?: 'inflow' | 'outflow' }) => {
    const newEntry: CashbookEntry = {
      id: `cb_${Date.now()}`,
      organizationId: organization.id,
      type: data.type || 'outflow',
      amount: data.amount,
      category: data.category as any,
      description: data.description,
      createdBy: currentUser?.name || 'Managing Director',
      createdAt: new Date().toISOString()
    };
    setCashbook(prev => [newEntry, ...prev]);
    closeModal();
    addToast('success', 'Cash Entry Posted', `${data.type === 'inflow' ? 'Inflow' : 'Disbursement'} of Rs. ${data.amount.toLocaleString()} logged.`);
  };

  const createVoucherDirect = (voucher: {
    voucherType: VoucherType;
    paymentMode?: 'cash' | 'bank' | 'journal';
    bankAccountId?: string;
    bankAccountName?: string;
    chequeNumber?: string;
    chequeDate?: string;
    description: string;
    category?: string;
    amount?: number;
    voucherDate?: string;
    entries: VoucherLineItem[];
    preparedBy?: string;
    approvedBy?: string;
  }) => {
    const debitSum = voucher.entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
    const creditSum = voucher.entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
    const totalAmount = voucher.amount || Math.max(debitSum, creditSum);
    const prefix = voucher.voucherType;
    const vId = `${prefix}-${Date.now().toString().slice(-4)}`;

    const newVoucher: CashbookEntry = {
      id: vId,
      voucherNumber: vId,
      voucherType: voucher.voucherType,
      organizationId: organization.id,
      type: (voucher.voucherType === 'CRV' || voucher.voucherType === 'BRV') ? 'inflow' : 'outflow',
      paymentMode: voucher.paymentMode || (voucher.voucherType.startsWith('B') ? 'bank' : voucher.voucherType === 'JV' ? 'journal' : 'cash'),
      bankAccountId: voucher.bankAccountId,
      bankAccountName: voucher.bankAccountName,
      chequeNumber: voucher.chequeNumber,
      chequeDate: voucher.chequeDate,
      amount: totalAmount,
      category: (voucher.category as any) || (voucher.voucherType === 'CRV' || voucher.voucherType === 'BRV' ? 'customer_payment' : 'misc'),
      description: voucher.description,
      createdBy: currentUser?.name || 'Managing Director',
      createdAt: (voucher.voucherDate ? new Date(voucher.voucherDate) : new Date()).toISOString(),
      entries: voucher.entries,
      preparedBy: voucher.preparedBy || currentUser?.name || 'Managing Director',
      approvedBy: voucher.approvedBy || 'Managing Director'
    };

    setCashbook(prev => [newVoucher, ...prev]);
    closeModal();
    addToast('success', 'Voucher Posted', `${voucher.voucherType} #${vId} of Rs. ${totalAmount.toLocaleString()} posted to ledger.`);
  };

  const updateCashbookEntry = (id: string, updated: Partial<CashbookEntry>) => {
    setCashbook(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
    closeEditModal();
    addToast('success', 'Voucher Updated', 'Cashbook entry adjusted.');
  };

  const deleteCashbookEntry = (id: string) => {
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin (adil@gmail.com) can delete cash entries.');
      return;
    }
    setCashbook(prev => prev.filter(c => c.id !== id));
    closeDeleteModal();
    addToast('info', 'Entry Deleted', 'Cash voucher deleted from ledger.');
  };

  // Chart of Accounts CRUD
  const addAccount = (data: Omit<ChartOfAccount, 'id' | 'organizationId' | 'createdAt'>) => {
    const newAcc: ChartOfAccount = {
      ...data,
      id: `acc_${Date.now()}`,
      organizationId: organization.id,
      createdAt: new Date().toISOString()
    };
    setAccounts(prev => [...prev, newAcc]);
    closeModal();
    addToast('success', 'Account Registered', `${newAcc.name} (${newAcc.code}) added to Chart of Accounts.`);
  };

  const updateAccount = (id: string, updated: Partial<ChartOfAccount>) => {
    setAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)));
    closeEditModal();
    addToast('success', 'Account Updated', 'Account parameters saved.');
  };

  const deleteAccount = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    if (acc?.isSystem) {
      addToast('error', 'Protected Account', 'Core system accounts cannot be deleted to preserve financial integrity.');
      return;
    }
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin can delete ledger accounts.');
      return;
    }
    setAccounts(prev => prev.filter(a => a.id !== id));
    closeDeleteModal();
    addToast('info', 'Account Removed', 'Account deleted from Chart of Accounts.');
  };

  // Supplier CRUD
  const createSupplierDirect = (data: Omit<Supplier, 'id' | 'organizationId' | 'createdAt'>) => {
    const newSupplier: Supplier = {
      ...data,
      id: `supp_${Date.now()}`,
      organizationId: organization.id,
      createdAt: new Date().toISOString()
    };
    setSuppliers(prev => [newSupplier, ...prev]);
    closeModal();
    addToast('success', 'Supplier Registered', `${newSupplier.name} added to vendor directory.`);
  };

  const updateSupplier = (id: string, updated: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
    closeEditModal();
    addToast('success', 'Supplier Updated', 'Vendor records updated.');
  };

  const deleteSupplier = (id: string) => {
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin can delete suppliers.');
      return;
    }
    setSuppliers(prev => prev.filter(s => s.id !== id));
    closeDeleteModal();
    addToast('info', 'Supplier Removed', 'Vendor deleted from directory.');
  };

  // Customer CRUD
  const createCustomerDirect = (data: Omit<Customer, 'id' | 'organizationId' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...data,
      id: `cust_${Date.now()}`,
      organizationId: organization.id,
      createdAt: new Date().toISOString()
    };
    setCustomers(prev => [newCustomer, ...prev]);
    closeModal();
    addToast('success', 'Customer Registered', `${newCustomer.name} added to client directory.`);
  };

  const updateCustomer = (id: string, updated: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, ...updated } : c)));
    closeEditModal();
    addToast('success', 'Customer Updated', 'Client records updated.');
  };

  const deleteCustomer = (id: string) => {
    if (!currentUser?.permissions?.canDeleteRecords) {
      addToast('error', 'Access Restricted', 'Only Super Admin can delete customers.');
      return;
    }
    setCustomers(prev => prev.filter(c => c.id !== id));
    closeDeleteModal();
    addToast('info', 'Customer Removed', 'Client deleted from directory.');
  };

  const confirmDeleteItem = () => {
    if (!deletingItem) return;
    if (deletingItem.type === 'product') deleteProduct(deletingItem.id);
    else if (deletingItem.type === 'po') deletePurchaseOrder(deletingItem.id);
    else if (deletingItem.type === 'sale') deleteSalesOrder(deletingItem.id);
    else if (deletingItem.type === 'cashbook') deleteCashbookEntry(deletingItem.id);
    else if (deletingItem.type === 'supplier') deleteSupplier(deletingItem.id);
    else if (deletingItem.type === 'customer') deleteCustomer(deletingItem.id);
    else if (deletingItem.type === 'account') deleteAccount(deletingItem.id);
  };

  const quickReceivePO = (poNumber: string) => {
    const res = toolReceiveGoods(getDBState(), { poIdOrNumber: poNumber });
    if (res.success && res.data) {
      applyDatabaseUpdate(res.data.updatedState);
      addToast('success', 'Goods Received', `${poNumber} goods restocked in factory warehouse.`);
    } else {
      addToast('error', 'Error Receiving Goods', res.error?.message || 'Failed to receive goods.');
    }
  };

  // Multi-Agent message dispatch with optional Groq API enhancement
  const sendMessage = async (content: string, method: 'text' | 'voice' = 'text') => {
    if (!content.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      inputMethod: method
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // Execute the deterministic Supervisor first
      const turnResult = await executeSupervisorTurn(content, getDBState(), method);

      // Augment the deterministic result with the server-proxied LLM summary.
      try {
        const groqResponse = await queryGroqChat(
          [
            {
              role: 'user',
              content: `You are an AI Industrial Copilot for a Pakistani textile SME. The deterministic rule engine resolved the following business output:
"${turnResult.message.content}"
User's query was: "${content}"
Provide a brief, crisp professional executive summary (1-3 sentences) in natural bilingual Urdu/English clarifying the operational and FBR compliance outcome.`
            }
          ],
          aiSettings.selectedModel || ''
        );

        if (groqResponse && groqResponse.trim()) {
          turnResult.message.content = `${groqResponse}\n\n---\n${turnResult.message.content}`;
        }
      } catch (groqErr) {
        // Expected when GROQ_API_KEY is not configured on the deployment —
        // the deterministic result alone is authoritative.
        console.info('LLM augmentation unavailable:', groqErr instanceof Error ? groqErr.message : groqErr);
      }

      if (turnResult.directDatabaseUpdate) {
        applyDatabaseUpdate(turnResult.directDatabaseUpdate);
      }

      if (turnResult.pendingConfirmation) {
        setActiveConfirmation(turnResult.pendingConfirmation);
      }

      setMessages(prev => [...prev, turnResult.message]);

      // Spoken voice feedback
      if (audioVoiceEnabled && (method === 'voice' || turnResult.message.content)) {
        speakVoiceResponse(turnResult.message.content);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ System error: ${err.message || 'Unable to execute operational request.'}`,
          timestamp: new Date().toISOString(),
          routedAgent: 'supervisor'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmAction = (payload: ConfirmationPayload) => {
    let resultMessage = '';
    let updatedDB: Partial<DatabaseState> = {};

    if (payload.actionType === 'create_purchase_order') {
      const p = payload.executeParams as any;
      const res = executeCreatePurchaseOrder(getDBState(), {
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        productId: p.productId,
        productName: p.productName,
        quantity: p.quantity,
        unit: p.unit,
        unitPrice: p.unitPrice,
        totalAmount: p.totalAmount
      });
      updatedDB = res.updatedState;
      resultMessage = `✅ **Purchase Order Issued Successfully**\n- **PO Number**: \`${res.newPo.poNumber}\`\n- **Supplier**: ${res.newPo.supplierName}\n- **Total Committed**: Rs. ${res.newPo.totalAmount.toLocaleString()}\n- **Status**: Pending vendor delivery.`;
    } else if (payload.actionType === 'record_sale') {
      const p = payload.executeParams as any;
      const res = executeRecordSale(getDBState(), {
        customerId: p.customerId,
        customerName: p.customerName,
        productId: p.productId,
        productName: p.productName,
        quantity: p.quantity,
        unit: p.unit,
        unitPrice: p.unitPrice,
        subtotal: p.subtotal,
        taxRate: p.taxRate,
        taxAmount: p.taxAmount,
        totalAmount: p.totalAmount
      });
      updatedDB = res.updatedState;
      resultMessage = `✅ **Sales Order & 18% GST Invoice Dispatched**\n- **Invoice #**: \`${res.newInvoice.invoiceNumber}\`\n- **Customer**: ${res.newInvoice.customerName}\n- **Grand Total (inc 18% GST)**: Rs. ${res.newInvoice.totalAmount.toLocaleString()}\n- **FBR Compliance**: Annexure-C reconciled.`;
    }

    applyDatabaseUpdate(updatedDB);
    setActiveConfirmation(null);

    setMessages(prev => [
      ...prev,
      {
        id: `msg_confirmed_${Date.now()}`,
        role: 'assistant',
        content: resultMessage,
        timestamp: new Date().toISOString(),
        routedAgent: 'supervisor'
      }
    ]);
    addToast('success', 'Action Executed', 'Database updated with deterministic verification.');

    if (audioVoiceEnabled) {
      speakVoiceResponse(resultMessage);
    }
  };

  const cancelAction = (payloadId: string) => {
    setActiveConfirmation(null);
    setMessages(prev => [
      ...prev,
      {
        id: `msg_cancel_${Date.now()}`,
        role: 'assistant',
        content: `❌ Action cancelled. No database records or stock levels were modified.`,
        timestamp: new Date().toISOString(),
        routedAgent: 'supervisor'
      }
    ]);
  };

  const triggerDemoPrompt = (prompt: string, method: 'text' | 'voice' = 'text') => {
    sendMessage(prompt, method);
  };

  const speakText = (text: string) => {
    speakVoiceResponse(text);
  };

  // Real Hardware Microphone & Groq Whisper Transcription Pipeline
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setMicErrorNotice(null);
        addToast('success', 'Microphone Granted', 'Hardware microphone access verified.');
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Microphone permission request error:', err);
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const msg = isIframe
        ? 'Embedded iframe blocks microphone permissions (The request is not allowed by the user agent or platform). Click "Open in Full Window" for native access.'
        : (err.message || 'Microphone access denied by browser.');
      setMicErrorNotice(msg);
      addToast('warning', 'Microphone Access Blocked', msg);
      return false;
    }
  };

  const startRecording = async () => {
    setIsRecording(true);
    setIsTranscribing(false);
    setRecordingTranscript('');
    audioChunksRef.current = [];
    setMicErrorNotice(null);

    // 1. Open real hardware microphone stream
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (!MediaRecorder.isTypeSupported('audio/webm')) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
            else mimeType = '';
          }
          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.start(200);
        }
      }
    } catch (err: any) {
      console.warn('Real microphone access not granted:', err);
      setIsRecording(false);
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      const errMsg = err.message || 'Microphone access not allowed in this context.';
      setMicErrorNotice(errMsg);
      if (isIframe) {
        addToast('warning', 'Microphone Restricted in Preview', 'Preview iframe blocks microphone. Use "Open in Full Window" in the modal or use one-tap action chips.');
      } else {
        addToast('warning', 'Microphone Blocked', 'Please grant microphone permissions in your browser address bar.');
      }
      return;
    }

    // 2. Parallel Web Speech API for instant interim preview while speaking
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (text.trim()) {
            setRecordingTranscript(text.trim());
          }
        };

        recognition.start();
        (window as any)._activeRecognition = recognition;
      } catch (e) {}
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Stop Web Speech interim
    if ((window as any)._activeRecognition) {
      try {
        (window as any)._activeRecognition.stop();
        (window as any)._activeRecognition = null;
      } catch (e) {}
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setIsTranscribing(true);

      recorder.onstop = async () => {
        // Release hardware mic stream
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(track => track.stop());
          micStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm'
        });

        if (audioBlob.size > 100) {
          try {
            addToast('info', 'Groq Whisper', 'Transcribing real voice audio via Whisper Large v3...');
            const transcript = await transcribeWithGroqWhisper(
              audioBlob,
              aiSettings.systemLanguage || 'both'
            );

            if (transcript && transcript.trim()) {
              setRecordingTranscript(transcript.trim());
              addToast('success', 'Voice Transcribed', `"${transcript.trim().substring(0, 45)}..."`);
            }
          } catch (err: any) {
            console.error('Groq Whisper error:', err);
            addToast('error', 'Transcription Failed', err.message || 'Groq Whisper could not transcribe.');
          } finally {
            setIsTranscribing(false);
          }
        } else {
          setIsTranscribing(false);
          if (audioBlob.size <= 100 && !recordingTranscript.trim()) {
            addToast('info', 'Recording Too Short', 'No audible speech captured for transcription.');
          }
        }
      };

      try {
        recorder.stop();
      } catch (e) {
        setIsTranscribing(false);
      }
    } else {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      setIsTranscribing(false);
    }
  };

  // Real Inventory Fetching & Automated Reorder Engine
  const fetchLiveInventoryData = (forceReload: boolean = false) => {
    // Reconcile physical warehouse inventory directly from transaction ledger
    const reconciledProducts = products.map(prod => {
      // Calculate true stock from received Purchase Orders minus dispatched Sales Orders
      const totalPurchased = purchaseOrders
        .filter(po => po.productId === prod.id && po.status === 'received')
        .reduce((sum, po) => sum + po.quantity, 0);

      const totalSold = salesOrders
        .filter(so => so.productId === prod.id && so.status === 'completed')
        .reduce((sum, so) => sum + so.quantity, 0);

      const computedStock = Math.max(0, totalPurchased - totalSold);
      return { ...prod, currentStock: computedStock, updatedAt: new Date().toISOString() };
    });

    setProducts(reconciledProducts);
    localStorage.setItem('copilot_products', JSON.stringify(reconciledProducts));

    const totalValuation = reconciledProducts.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0);
    const lowStockCount = reconciledProducts.filter(p => p.currentStock <= p.reorderThreshold).length;

    addToast(
      'success',
      'Inventory Reconciled & Synced',
      `Live audit complete: ${reconciledProducts.length} materials tracked. Total asset valuation: Rs. ${totalValuation.toLocaleString()} (${lowStockCount} items below safety threshold).`
    );
  };

  const reorderProduct = (productNameOrSku: string, customQty?: number) => {
    const res = prepareReorderLowStockConfirmation(getDBState(), {
      specificProduct: productNameOrSku,
      customQuantity: customQty
    });
    if (res.success && res.data?.confirmation) {
      setActiveConfirmation(res.data.confirmation);
      setActiveTab('copilot');
      addToast('info', 'Reorder PO Prepared', `Review replenishment PO for ${res.data.confirmation.details.product}`);
    } else {
      addToast('error', 'Reorder Notice', res.error?.message || 'Could not prepare reorder.');
    }
  };

  const reorderAllLowStock = () => {
    const res = prepareReorderLowStockConfirmation(getDBState());
    if (res.success && res.data?.confirmation) {
      setActiveConfirmation(res.data.confirmation);
      setActiveTab('copilot');
      addToast('info', 'Low Stock Reorder Ready', `Replenishment batch calculated for critical deficit items.`);
    } else {
      addToast('info', 'Inventory Optimal', res.error?.message || 'All raw materials are above reorder thresholds.');
    }
  };

  const resetAllData = () => {
    setProducts([]);
    setSuppliers([]);
    setCustomers([]);
    setPurchaseOrders([]);
    setSalesOrders([]);
    setCashbook([]);
    setAccounts(INITIAL_CHART_OF_ACCOUNTS);
    setInventoryMovements([]);
    localStorage.removeItem('copilot_products');
    localStorage.removeItem('copilot_suppliers');
    localStorage.removeItem('copilot_customers');
    localStorage.removeItem('copilot_pos');
    localStorage.removeItem('copilot_sales');
    localStorage.removeItem('copilot_cashbook');
    localStorage.removeItem('copilot_chart_of_accounts');
    localStorage.removeItem('copilot_movements');
    setBranding(DEFAULT_BRANDING);
    setAiSettings(DEFAULT_AI_SETTINGS);
    setActiveConfirmation(null);
    addToast('info', 'Ledger Reset', 'All transactions and records cleared. System is in clean production state.');
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
        searchQuery,
        setSearchQuery,
        currentUser,
        isAuthenticated,
        login,
        logout,
        setAuthUser,
        sessionExpired,
        userAccounts,
        createUserAccount,
        updateUserAccount,
        deleteUserAccount,
        branding,
        brandingSettings: branding,
        updateBranding,
        aiSettings,
        updateAISettings,
        activeModal,
        openModal,
        closeModal,
        viewingItem,
        openViewModal,
        closeViewModal,
        editingItem,
        openEditModal,
        closeEditModal,
        deletingItem,
        openDeleteModal,
        closeDeleteModal,
        confirmDeleteItem,
        printDocument,
        openPrintDocument,
        closePrintDocument,
        organization,
        profile,
        products,
        suppliers,
        customers,
        purchaseOrders,
        salesOrders,
        inventoryMovements,
        cashbook,
        accounts,
        cashInHand,
        bankBalance,
        totalLiquidity,
        complianceSources,
        createProductDirect,
        updateProduct,
        deleteProduct,
        createPurchaseOrderDirect,
        updatePurchaseOrder,
        deletePurchaseOrder,
        recordSaleDirect,
        updateSalesOrder,
        deleteSalesOrder,
        recordExpenseDirect,
        createVoucherDirect,
        updateCashbookEntry,
        deleteCashbookEntry,
        addAccount,
        updateAccount,
        deleteAccount,
        createSupplierDirect,
        updateSupplier,
        deleteSupplier,
        createCustomerDirect,
        updateCustomer,
        deleteCustomer,
        messages,
        isProcessing,
        activeConfirmation,
        sendMessage,
        confirmAction,
        cancelAction,
        quickReceivePO,
        resetAllData,
        isRecording,
        isTranscribing,
        recordingTranscript,
        startRecording,
        stopRecording,
        setRecordingTranscript,
        audioVoiceEnabled,
        toggleAudioVoice,
        speakText,
        micErrorNotice,
        clearMicErrorNotice,
        requestMicrophonePermission,
        fetchLiveInventoryData,
        reorderProduct,
        reorderAllLowStock,
        triggerDemoPrompt,
        notifications,
        dismissNotification,
        addToast,
        darkMode,
        toggleDarkMode,
        syncDatabase,
        syncTimestamp
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
