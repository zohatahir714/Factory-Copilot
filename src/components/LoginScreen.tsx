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
  RefreshCw
} from 'lucide-react';
import {
  getSupabaseConfig,
  supabaseSignIn,
  checkSupabaseHealth
} from '../supabaseClient';
import { SESSION_IDLE_TIMEOUT_MS } from '../context/AppContext';

const IDLE_MINUTES = Math.round(SESSION_IDLE_TIMEOUT_MS / 60000);


export const LoginScreen: React.FC = () => {
  const { branding, login, setAuthUser, darkMode, toggleDarkMode, addToast, sessionExpired } = useApp();

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
      // 1. Local Auth Registry first. Every account this app provisions
      //    (Settings module and the demo super admins) lives here, so valid
      //    local logins resolve without touching Supabase Auth — repeated
      //    logins with demo credentials can never produce invalid_grant 400s.
      const localSuccess = login(trimmedEmail, trimmedPassword);
      if (localSuccess) {
        return;
      }

      // 2. Supabase Auth for cloud-only accounts (provisioned directly in the
      //    Supabase dashboard and therefore absent from the local registry).
      const { isConfigured } = getSupabaseConfig();
      if (isConfigured) {
        const authRes = await supabaseSignIn(trimmedEmail, trimmedPassword);
        if (authRes.success && authRes.user) {
          setAuthUser(authRes.user);
          addToast('success', 'Authenticated via Supabase', authRes.message);
          return;
        }
      }

      setError('Invalid credentials. Please contact your system administrator to provision or reset your account.');
    } catch (err: any) {
      setError(err?.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto transition-colors duration-200 bg-[var(--color-canvas)] dark:bg-[var(--color-canvas-dark)]">
      {/* Ambient backdrop — soft indigo field (light), deep glow + hairline grid (dark) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-indigo-400/15 blur-[110px] dark:bg-indigo-600/10" />
        <div className="absolute -bottom-40 -right-20 w-[32rem] h-[32rem] rounded-full bg-violet-300/20 blur-[120px] dark:bg-indigo-500/[0.07]" />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.045) 1px, transparent 1px)',
            backgroundSize: '44px 44px'
          }}
        />
      </div>

      {/* Theme Toggle in Top Right */}
      <button
        type="button"
        id="btn-login-theme-toggle"
        onClick={toggleDarkMode}
        className="fixed top-5 right-5 p-2.5 rounded-full surface-card ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer z-10"
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
      </button>

      <div className="relative w-full max-w-[400px] surface-card p-8 space-y-5 animate-bentoIn my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-500/10 dark:to-white/[0.03] border border-indigo-100 dark:border-indigo-400/20 flex items-center justify-center overflow-hidden shadow-sm">
            {branding.logoBase64 ? (
              <img src={branding.logoBase64} alt={branding.companyName} className="w-full h-full object-contain p-1.5" />
            ) : (
              <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight text-slate-900 dark:text-white">
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
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Notice</span>
              <span>{successMsg}</span>
            </div>
          </div>
        )}

        {/* Idle-session expiry notice (PRD §8) */}
        {sessionExpired && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Session expired</span>
              <span>You were signed out after {IDLE_MINUTES} {IDLE_MINUTES === 1 ? 'minute' : 'minutes'} of inactivity. Please sign in again.</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Authentication Error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Sign In / Password Reset Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* EMAIL FIELD */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
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
                className="w-full pl-9 pr-3.5 field-input"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* PASSWORD FIELD */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                id="input-auth-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 field-input"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* CHECKBOXES & OPTIONS */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[13px] text-slate-600 dark:text-slate-400">
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

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            id="btn-auth-submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none text-white rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(99,102,241,0.55)] transition-all cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 text-center text-[12px] text-slate-400 dark:text-slate-500">
          <span>Enterprise Access Only. Accounts are provisioned by Super Administrators.</span>
        </div>

        {/* Demo credentials — judges can sign in with the seeded Super Admin. */}
        <div className="pt-1 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-white/5 rounded-full px-3.5 py-1.5 font-mono" title="Demo credentials for evaluation">
            <KeyRound className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
            <span>Demo login:</span>
            <button
              type="button"
              onClick={() => { setEmail('admin@gmail.com'); setPassword('admin123'); setError(null); setSuccessMsg(null); }}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              title="Click to fill the form with demo credentials"
            >
              admin@gmail.com / admin123
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
export default LoginScreen;
