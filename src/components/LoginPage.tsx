import { useState } from 'react';
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
  const { setUser, setToken, setIsAuthenticated } = useAppStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const response = (await authAPI.login(email, password)) as { data?: { user: any; token: string } };
        if (response?.data) {
          const { user, token } = response.data;
          setUser(user);
          setToken(token);
          setIsAuthenticated(true);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          toast.success(`Welcome back, ${user.name}!`);
          navigate('/');
        }
      } else {
        const response = (await authAPI.register({
          name,
          email,
          password,
          company: 'AI Test Org',
          department: 'Quality Assurance',
        })) as { data?: { user: any; token: string } };
        if (response?.data) {
          const { user, token } = response.data;
          setUser(user);
          setToken(token);
          setIsAuthenticated(true);
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          toast.success('Account created successfully!');
          navigate('/');
        }
      }
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : 'Authentication failed. Please check your credentials.';
      console.error('Auth error:', err);
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

          {/* Social / Other Info */}
          <div className="mt-10 flex flex-col items-center gap-4">
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
