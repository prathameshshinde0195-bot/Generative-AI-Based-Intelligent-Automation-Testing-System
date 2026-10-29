import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Brain,
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  X,
  Settings,
} from 'lucide-react';
import { useAppStore } from '../lib/store';
import { authAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Password reset & verification state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Google OAuth Client ID config state
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [customClientId, setCustomClientId] = useState(() => {
    return localStorage.getItem('jnet_google_client_id') || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  });

  const { setUser, setToken, setIsAuthenticated } = useAppStore();
  const navigate = useNavigate();

  // Check URL query parameters for ?reset=<token> or ?verify=<token>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset');
    const verify = params.get('verify');

    if (reset) {
      setResetToken(reset);
      toast.info('Please enter your new password to complete the reset.');
    }

    if (verify) {
      void handleVerifyEmailParam(verify);
    }
  }, []);

  const handleVerifyEmailParam = async (rawToken: string) => {
    try {
      const res: any = await authAPI.verifyEmail(rawToken);
      toast.success(res?.message || 'Email verified successfully! You can now log in.');
      // Remove query param cleanly
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      toast.error(err?.message || 'Email verification link is invalid or expired');
    }
  };

  useEffect(() => {
    const scriptId = 'google-gis-sdk';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleGis();
      };
      document.body.appendChild(script);
    } else {
      initGoogleGis();
    }
  }, []);

  const initGoogleGis = () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
    if (clientId && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response: { credential?: string }) => {
            if (response?.credential) {
              void handleGoogleCredentialResponse(response.credential);
            }
          },
        });
        const container = document.getElementById('google-btn-container');
        if (container) {
          (window as any).google.accounts.id.renderButton(container, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            width: container.offsetWidth || 340,
            text: 'continue_with',
          });
        }
      } catch (err) {
        console.warn('Google GIS initialize notice:', err);
      }
    }
  };

  const handleGoogleCredentialResponse = async (credential: string) => {
    setIsGoogleLoading(true);
    try {
      const response: any = await authAPI.googleLogin({ credential });
      const payload = response?.data || response;
      const user = payload?.user;
      const token = payload?.token;
      if (user && token) {
        setUser(user);
        setToken(token);
        setIsAuthenticated(true);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        toast.success(payload.message || `Signed in as ${user.name}`);
        navigate('/');
      } else {
        throw new Error('Google sign-in did not return a valid user session');
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      toast.error(err?.message || 'Google authentication failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /**
   * Real Google Account Chooser:
   * Uses prompt='select_account' so the user is presented with Google's account selection modal
   */
  const getEffectiveGoogleClientId = () => {
    return (
      (window as any).VITE_GOOGLE_CLIENT_ID ||
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem('jnet_google_client_id') ||
      ''
    );
  };

  /**
   * Real Google Account Chooser:
   * Uses prompt='select_account' so the user is presented with Google's account selection modal
   */
  const handleGoogleAccountChooser = () => {
    const clientId = getEffectiveGoogleClientId();

    if (!clientId) {
      setIsGoogleLoading(false);
      setShowGoogleConfigModal(true);
      return;
    }

    setIsGoogleLoading(true);

    // If client ID is configured and GIS oauth2 is loaded, trigger popup account chooser
    if ((window as any).google?.accounts?.oauth2) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          prompt: 'select_account', // FORCES ACCOUNT SELECTION
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                toast.info('Google sign-in was cancelled.');
              } else {
                toast.error(`Google authentication error: ${tokenResponse.error}`);
              }
              setIsGoogleLoading(false);
              return;
            }

            if (tokenResponse?.access_token) {
              try {
                const response: any = await authAPI.googleLogin({ accessToken: tokenResponse.access_token });
                const payload = response?.data || response;
                const user = payload?.user;
                const token = payload?.token;
                if (user && token) {
                  setUser(user);
                  setToken(token);
                  setIsAuthenticated(true);
                  localStorage.setItem('token', token);
                  localStorage.setItem('user', JSON.stringify(user));
                  toast.success(payload.message || `Signed in as ${user.name}`);
                  navigate('/');
                } else {
                  throw new Error('Google sign-in did not return a valid session');
                }
              } catch (err: any) {
                toast.error(err?.message || 'Failed to authenticate Google account with server');
              } finally {
                setIsGoogleLoading(false);
              }
            }
          },
          error_callback: (err: any) => {
            setIsGoogleLoading(false);
            if (err?.type === 'popup_closed') {
              toast.info('Google sign-in cancelled.');
            } else {
              toast.error('Google sign-in popup was blocked or closed. Please allow popups.');
            }
          },
        });

        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('oauth2 token client error:', err);
      }
    }

    setIsGoogleLoading(false);
    toast.error('Google Identity Services is loading. Please retry in 2 seconds.');
  };

  const handleSaveGoogleClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customClientId.trim();
    if (!cleanId) {
      toast.error('Please enter a valid Google OAuth Client ID');
      return;
    }
    localStorage.setItem('jnet_google_client_id', cleanId);
    (window as any).VITE_GOOGLE_CLIENT_ID = cleanId;
    setShowGoogleConfigModal(false);
    toast.success('Google OAuth Client ID configured successfully!');
    setTimeout(() => {
      handleGoogleAccountChooser();
    }, 250);
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setIsLogin(true);
    setIsLoading(true);
    try {
      const response: any = await authAPI.login(quickEmail, quickPass);
      const payload = response?.data || response;
      const user = payload?.user;
      const token = payload?.token;
      if (user && token) {
        setUser(user);
        setToken(token);
        setIsAuthenticated(true);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        toast.success(`Welcome back, ${user.name}!`);
        navigate('/');
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Quick login failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim();
    const cleanName = name.trim();

    if (!cleanEmail) {
      toast.error('Please enter your email address');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!isLogin && !cleanName) {
      toast.error('Please enter your full name');
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const response: any = await authAPI.login(cleanEmail, password);
        const payload = response?.data || response;
        const user = payload?.user;
        const token = payload?.token;
        if (user && token) {
          setUser(user);
          setToken(token);
          setIsAuthenticated(true);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          toast.success(`Welcome back, ${user.name}!`);
          navigate('/');
        } else {
          throw new Error('Invalid response received from authentication server');
        }
      } else {
        const response: any = await authAPI.register({
          name: cleanName,
          email: cleanEmail,
          password,
          company: 'AI Test Org',
          department: 'Quality Assurance',
        });
        const payload = response?.data || response;
        const user = payload?.user;
        const token = payload?.token;
        if (user && token) {
          setUser(user);
          setToken(token);
          setIsAuthenticated(true);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          toast.success('Account created successfully! Check your email for a welcome message.');
          navigate('/');
        } else {
          throw new Error('Invalid response received from registration server');
        }
      }
    } catch (err: any) {
      console.error('Auth error details:', err);
      let msg = 'Authentication failed. Please check your details.';
      if (err?.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err?.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        msg = err.response.data.errors.join('. ');
      } else if (err?.message) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Please enter your registered email address');
      return;
    }

    setIsSendingReset(true);
    try {
      const res: any = await authAPI.forgotPassword(forgotEmail.trim());
      toast.success(res?.message || 'Password reset link sent! Please check your email.');
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (err: any) {
      toast.error(err?.message || 'Could not process password reset request');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!resetToken) {
      toast.error('Missing password reset token');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res: any = await authAPI.resetPassword(resetToken, newPassword);
      toast.success(res?.message || 'Password reset successful! Please log in.');
      setResetToken(null);
      setNewPassword('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reset password. Link may be expired.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#10182A] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-700/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-800/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#18213A] border border-[#232B45] rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Reset Password</h3>
                  <p className="text-xs text-slate-400">JNET Testing System Password Recovery</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 mb-5">
                Enter your registered email address. We will send you a secure, single-use link to choose a new password.
              </p>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full pl-12 pr-4 py-3.5 bg-[#232B45] border border-[#232B45] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-3 bg-[#232B45] text-slate-300 font-bold rounded-xl hover:bg-[#2A3756] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Google OAuth Client ID Configuration Modal */}
      <AnimatePresence>
        {showGoogleConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#18213A] border border-cyan-500/30 rounded-3xl p-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setShowGoogleConfigModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Google OAuth Client ID</h3>
                  <p className="text-xs text-slate-400">JNET Testing System Google Account Chooser</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 mb-4">
                To launch the live Google Account Chooser (<code className="text-cyan-400 bg-[#10182A] px-1.5 py-0.5 rounded text-xs">prompt=select_account</code>), enter your Google OAuth 2.0 Web Client ID:
              </p>

              <form onSubmit={handleSaveGoogleClientId} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Google Client ID
                  </label>
                  <input
                    type="text"
                    value={customClientId}
                    onChange={(e) => setCustomClientId(e.target.value)}
                    placeholder="e.g. 123456789-xxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-4 py-3.5 bg-[#232B45] border border-cyan-500/30 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    required
                  />
                </div>

                <div className="bg-[#10182A]/80 border border-[#232B45] rounded-xl p-3 text-xs text-slate-300 space-y-1.5">
                  <p className="font-semibold text-cyan-400">Google Cloud Console Setup:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>Create OAuth 2.0 Client ID (Type: Web Application)</li>
                    <li>
                      Add Authorized JavaScript Origins:
                      <div className="mt-1 font-mono text-[11px] text-cyan-300 bg-[#18213A] p-1.5 rounded break-all">
                        https://generative-ai-based-intelligent-aut-delta.vercel.app
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGoogleConfigModal(false)}
                    className="flex-1 py-3 bg-[#232B45] text-slate-300 font-bold rounded-xl hover:bg-[#2A3756] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    Save & Connect
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#18213A] border border-[#232B45] rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative"
        >
          {/* Header & Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20 mb-4"
            >
              <Brain className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              JNET Testing System
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Intelligent QA Automation Platform
            </p>
          </div>

          {/* If ?reset=<token> is in URL, render the Reset Password Form directly */}
          {resetToken ? (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-5">
              <div className="p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl mb-4 text-center">
                <KeyRound className="w-6 h-6 text-cyan-400 mx-auto mb-1.5" />
                <h3 className="text-sm font-bold text-white">Create New Password</h3>
                <p className="text-xs text-slate-400">Choose a strong password for your account</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  New Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-[#232B45] border border-[#232B45] rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
                    placeholder="At least 6 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isResettingPassword}
                className="w-full py-4 rounded-2xl text-white font-bold text-lg bg-gradient-to-r from-cyan-400 to-blue-600 shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 cursor-pointer"
              >
                {isResettingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set New Password'}
              </button>

              <button
                type="button"
                onClick={() => setResetToken(null)}
                className="w-full text-center text-xs text-slate-400 hover:text-white pt-2 cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <>
              {/* Tab Selector: Sign In / Sign Up */}
              <div className="flex bg-[#10182A] p-1.5 rounded-2xl mb-6 border border-[#232B45]">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                    isLogin ? 'bg-[#18213A] text-cyan-400 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                    !isLogin ? 'bg-[#18213A] text-purple-400 shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Real Google Account Chooser */}
              <div className="mb-6">
                <div id="google-btn-container" className="w-full flex justify-center mb-2" />
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleGoogleAccountChooser}
                    disabled={isGoogleLoading}
                    className="flex-1 py-3.5 px-4 bg-[#232B45] hover:bg-[#2A3455] border border-cyan-500/20 hover:border-cyan-400/50 rounded-2xl text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-md disabled:opacity-60 cursor-pointer"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setShowGoogleConfigModal(true)}
                    title="Configure Google OAuth Client ID"
                    className="p-3.5 bg-[#232B45] hover:bg-[#2A3455] border border-cyan-500/20 hover:border-cyan-400/50 rounded-2xl text-slate-400 hover:text-cyan-400 transition-all cursor-pointer shrink-0"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#232B45]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#18213A] px-3 text-slate-400 font-semibold tracking-wider">
                      or continue with email
                    </span>
                  </div>
                </div>
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                        Full Name
                      </label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-[#232B45] border border-[#232B45] rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 focus:bg-[#232B45] transition-all"
                          placeholder="John Doe"
                          required={!isLogin}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-[#232B45] border border-[#232B45] rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 focus:bg-[#232B45] transition-all"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Password
                    </label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setShowForgotModal(true);
                        }}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-[#232B45] border border-[#232B45] rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 focus:bg-[#232B45] transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-70 cursor-pointer ${
                    isLogin
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-700 shadow-cyan-800/30 hover:shadow-cyan-400/40'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-700 shadow-purple-800/30 hover:shadow-purple-400/40'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isLogin ? (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <UserPlus className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Quick Demo Access for Testing & Viva */}
              <div className="mt-6 pt-5 border-t border-[#232B45]">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center mb-3">
                  One-Click Viva Demo Accounts
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleQuickLogin('admin@test.com', 'Admin@123')}
                    className="p-3 bg-[#232B45]/90 hover:bg-[#2A3756] border border-cyan-500/30 hover:border-cyan-400 rounded-xl text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300">Admin Demo</div>
                    <div className="text-[11px] text-slate-400 truncate">admin@test.com</div>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleQuickLogin('qa@test.com', 'QA@123')}
                    className="p-3 bg-[#232B45]/90 hover:bg-[#2A3756] border border-purple-500/30 hover:border-purple-400 rounded-xl text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="text-xs font-bold text-purple-400 group-hover:text-purple-300">QA Lead Demo</div>
                    <div className="text-[11px] text-slate-400 truncate">qa@test.com</div>
                  </button>
                </div>
              </div>

              {/* Social / Security Info */}
              <div className="mt-6 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Enterprise-Grade Security Enabled</span>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Bottom Switch Note */}
        {!resetToken && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-slate-500 text-sm mt-8"
          >
            {isLogin ? "New to JNET Testing System?" : "Existing user?"}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-cyan-400 font-bold hover:underline cursor-pointer"
            >
              {isLogin ? 'Create an Account' : 'Sign In Here'}
            </button>
          </motion.p>
        )}
      </div>
    </div>
  );
}
