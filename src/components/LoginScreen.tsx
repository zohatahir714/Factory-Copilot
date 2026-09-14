import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  LogIn,
  KeyRound,
  Mail,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import {
  getSupabaseConfig,
  supabaseSignIn,
  supabaseResetPassword,
  checkSupabaseHealth
} from '../supabaseClient';
import { SESSION_IDLE_TIMEOUT_MS } from '../context/AppContext';

const IDLE_MINUTES = Math.round(SESSION_IDLE_TIMEOUT_MS / 60000);

type AuthMode = 'signin' | 'forgot_password';

export const LoginScreen: React.FC = () => {
  const { branding, login, setAuthUser, darkMode, toggleDarkMode, addToast, sessionExpired } = useApp();

  // Auth Mode: Sign In or Forgot Password
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Form Fields
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('copilot_remember_email') || '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem('copilot_remember_email');
  });

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Connection Status
  const [connectionHealth, setConnectionHealth] = useState<{
    status: 'connected' | 'disconnected' | 'local_only' | 'error';
    message: string;
  }>({
    status: 'local_only',
    message: 'Checking database connection...'
  });

  // Check Supabase health on load
  useEffect(() => {
    let isMounted = true;
    checkSupabaseHealth().then(res => {
      if (isMounted) {
        setConnectionHealth({
          status: res.status,
          message: res.message
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Main Auth Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Remember email preference
    if (rememberMe && trimmedEmail) {
      localStorage.setItem('copilot_remember_email', trimmedEmail);
    } else {
      localStorage.removeItem('copilot_remember_email');
    }

    try {
      if (authMode === 'signin') {
        // 1. Try Supabase Auth if configured
        const { isConfigured } = getSupabaseConfig();
        if (isConfigured) {
          const authRes = await supabaseSignIn(trimmedEmail, trimmedPassword);
          if (authRes.success && authRes.user) {
            setAuthUser(authRes.user);
            addToast('success', 'Authenticated via Supabase', authRes.message);
            setIsSubmitting(false);
            return;
          }
        }

        // 2. Fallback to Local Auth Registry in AppContext
        const localSuccess = login(trimmedEmail, trimmedPassword);
        if (!localSuccess) {
          setError('Invalid credentials. Please contact your system administrator to provision or reset your account.');
        }
      } else if (authMode === 'forgot_password') {
        if (!trimmedEmail) {
          setError('Please enter your corporate email address.');
          setIsSubmitting(false);
          return;
        }

        const { isConfigured } = getSupabaseConfig();
        if (isConfigured) {
          const resetRes = await supabaseResetPassword(trimmedEmail);
          if (resetRes.success) {
            setSuccessMsg(resetRes.message);
            addToast('success', 'Recovery Email Sent', resetRes.message);
          } else {
            setError(resetRes.message || 'Failed to send password reset request.');
          }
        } else {
          setSuccessMsg('In offline mode, please contact your Super Admin to reset your account password from the Settings module.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 overflow-y-auto transition-colors duration-200">
      {/* Theme Toggle in Top Right */}
      <button
        type="button"
        id="btn-login-theme-toggle"
        onClick={toggleDarkMode}
        className="fixed top-5 right-5 p-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs transition-colors cursor-pointer z-10"
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
      </button>

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5 transition-colors duration-200 my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-xs">
            {branding.logoBase64 ? (
              <img src={branding.logoBase64} alt={branding.companyName} className="w-full h-full object-contain p-1.5" />
            ) : (
              <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {branding.companyName || 'PakERP & Textile OS'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {branding.tagline || 'Enterprise ERP, Treasury & FBR Compliance Suite'}
            </p>
          </div>

          {/* Database & Auth Mode Badge */}
          <div className="flex items-center justify-center pt-0.5">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                connectionHealth.status === 'connected'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionHealth.status === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span>
                {connectionHealth.status === 'connected'
                  ? 'Supabase Cloud Auth Active'
                  : 'Enterprise Local Storage'}
              </span>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Notice</span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* Idle-session expiry notice (PRD §8) */}
        {sessionExpired && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Session expired</span>
              <span>You were signed out after {IDLE_MINUTES} {IDLE_MINUTES === 1 ? 'minute' : 'minutes'} of inactivity. Please sign in again.</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Authentication Error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Sign In / Password Reset Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* EMAIL FIELD */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Corporate Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                id="input-auth-email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 outline-none font-medium transition-all"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* PASSWORD FIELD (Sign In Only) */}
          {authMode === 'signin' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot_password');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  id="input-auth-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 outline-none font-medium transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* CHECKBOXES & OPTIONS */}
          {authMode === 'signin' && (
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400 text-xs">
                <input
                  type="checkbox"
                  id="checkbox-remember-me"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Remember this device</span>
              </label>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            id="btn-auth-submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : authMode === 'signin' ? (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </>
            ) : (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>Send Password Reset Link</span>
              </>
            )}
          </button>
        </form>

        {/* FORGOT PASSWORD RETURN BACK */}
        {authMode === 'forgot_password' && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError(null);
                setSuccessMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </button>
          </div>
        )}

        <div className="pt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          <span>Enterprise Access Only. Accounts are provisioned by Super Administrators.</span>
        </div>
      </div>
    </div>
  );
};
export default LoginScreen;
