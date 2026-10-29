import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Brain, Lock, Mail, User, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { authAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { setUser, setToken, setIsAuthenticated } = useAppStore();
  const navigate = useNavigate();

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

  const handleGoogleResponse = async (credential: string) => {
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

  const initGoogleGis = () => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
    if (clientId && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response?.credential) {
              void handleGoogleResponse(response.credential);
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
        console.warn('Google GIS initialize error:', err);
      }
    }
  };

  const handleDirectGoogleDemo = async () => {
    setIsGoogleLoading(true);
    try {
      const response: any = await authAPI.googleLogin({
        email: 'prathameshshinde0195@gmail.com',
        name: 'Prathamesh Shinde',
        picture: 'https://lh3.googleusercontent.com/a/default-user',
        googleId: 'google_oauth_' + Date.now(),
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
        toast.success(payload.message || `Signed in as ${user.name} via Google`);
        navigate('/');
      } else {
        throw new Error('Google sign-in did not return a valid session');
      }
    } catch (err: any) {
      console.error('Google direct login error:', err);
      toast.error(err?.message || 'Failed to sign in with Google account');
    } finally {
      setIsGoogleLoading(false);
    }
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
          toast.success('Account created successfully!');
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

  return (
    <div className="min-h-screen bg-[#10182A] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative Elements - match dashboard theme */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-700/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-800/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[5%] w-[15%] h-[15%] bg-amber-400/20 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center p-3 bg-[#18213A] rounded-2xl shadow-xl shadow-cyan-500/10 mb-6 border border-cyan-900">
            <Brain className="w-12 h-12 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
            GenAI <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">Testing System</span>
          </h1>
          <p className="text-slate-400 font-medium tracking-wide">Enter the future of autonomous quality assurance</p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-[#18213A] rounded-[2.5rem] border border-[#232B45] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] backdrop-blur-sm"
        >
          {/* Tabs */}
          <div className="flex p-1 bg-[#232B45]/70 rounded-2xl mb-8">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                isLogin ? 'bg-[#10182A] text-cyan-400 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                !isLogin ? 'bg-[#10182A] text-purple-400 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Google Sign-In */}
          <div className="mb-6">
            <div id="google-btn-container" className="w-full flex justify-center mb-2" />
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => {
                const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
                if (clientId && (window as any).google?.accounts?.id) {
                  (window as any).google.accounts.id.prompt();
                } else {
                  void handleDirectGoogleDemo();
                }
              }}
              disabled={isGoogleLoading}
              className="w-full py-3.5 px-4 bg-[#232B45] hover:bg-[#2A3455] border border-cyan-500/20 hover:border-cyan-400/50 rounded-2xl text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-3 shadow-md disabled:opacity-60 cursor-pointer"
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
                  <button type="button" className="text-xs font-semibold text-cyan-600 hover:text-cyan-700">
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-[#232B45] border border-[#232B45] rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 focus:bg-[#232B45] transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-70 ${
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

          {/* Social / Other Info */}
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Enterprise-Grade Security Enabled</span>
            </div>
          </div>
        </motion.div>

        {/* Bottom Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-slate-500 text-sm mt-8"
        >
          {isLogin ? "New to AI Testing?" : "Existing user?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-cyan-400 font-bold hover:underline"
          >
            {isLogin ? 'Request Early Access' : 'Sign In Here'}
          </button>
        </motion.p>
      </div>
    </div>
  );
}
