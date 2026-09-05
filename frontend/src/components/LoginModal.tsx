import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';
import hoodedHackerImg from '../assets/hooded-hacker.jpg';

interface LoginModalProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('priya.verma@tracex.gov.in');
  const [password, setPassword] = useState('Investigator123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { user, token } = unwrapData<{ user: any; token: string }>(res.data);
      localStorage.setItem('tracex_jwt_token', token);
      onLoginSuccess(user, token);
    } catch (err: any) {
      setError(err.userMessage ?? err.response?.data?.error ?? 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError(null);
    setInfoMessage(null);
  };

  const handleGoogleLogin = () => {
    setError(null);
    setInfoMessage('Google SSO integration requires OAuth environment configuration. Using demo credentials below.');
  };

  const handleForgotPassword = () => {
    setError(null);
    setInfoMessage('Password reset instructions have been dispatched to your administrative email address.');
  };

  const handleSignUp = () => {
    setError(null);
    setInfoMessage('User registration is restricted to authorized TRACE-X agency personnel. Contact your system administrator.');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0A0A0A] text-[#F2F2F2] font-sans min-h-screen overflow-y-auto p-4 sm:p-6 lg:p-10 select-none">
      
      {/* Brand Header */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between pt-2 pb-6">
        <div className="flex items-center space-x-2 text-2xl font-bold tracking-tight">
          <span className="text-white font-extrabold tracking-tight">TRACE</span>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#6D4AFF] text-white text-sm font-bold shadow-md shadow-[#6D4AFF]/40">
            X
          </span>
        </div>

        {/* Quick Demo Preset Pills */}
        <div className="hidden sm:flex items-center space-x-2 bg-[#111114] border border-white/10 p-1 rounded-xl text-xs">
          <span className="px-2 text-[11px] font-semibold text-[#8A8F98] uppercase tracking-wider">Demo Accounts:</span>
          <button
            type="button"
            onClick={() => selectPreset('admin@tracex.gov.in', 'AdminPass123!')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium text-xs ${
              email === 'admin@tracex.gov.in' ? 'bg-[#6D4AFF] text-white font-semibold' : 'text-[#8A8F98] hover:text-white'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => selectPreset('priya.verma@tracex.gov.in', 'Investigator123!')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium text-xs ${
              email === 'priya.verma@tracex.gov.in' ? 'bg-[#6D4AFF] text-white font-semibold' : 'text-[#8A8F98] hover:text-white'
            }`}
          >
            Investigator
          </button>
          <button
            type="button"
            onClick={() => selectPreset('amit.patel@tracex.gov.in', 'Analyst123!')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium text-xs ${
              email === 'amit.patel@tracex.gov.in' ? 'bg-[#6D4AFF] text-white font-semibold' : 'text-[#8A8F98] hover:text-white'
            }`}
          >
            Analyst
          </button>
        </div>
      </div>

      {/* Main Centered Circuit Card Container */}
      <div className="w-full max-w-5xl mx-auto my-auto relative">
        
        {/* Decorative Circuit Border (SVG) matching Reference Image 1 shape + TRACE-X Violet Accent */}
        <div className="absolute -inset-4 sm:-inset-6 pointer-events-none z-0">
          <svg
            className="w-full h-full text-[#6D4AFF] overflow-visible"
            viewBox="0 0 1000 600"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="violet-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Chamfered Circuit Path */}
            <path
              d="M 30,2 L 670,2 L 690,22 L 830,22 L 850,2 L 970,2 L 998,30 L 998,570 L 970,598 L 640,598 L 620,578 L 480,578 L 460,598 L 30,598 L 2,570 L 2,30 Z"
              fill="none"
              stroke="#6D4AFF"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
              filter="url(#violet-glow)"
              opacity="0.85"
            />

            {/* Glowing Circuit Node Dots */}
            <circle cx="30" cy="2" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="690" cy="22" r="3.5" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="1.5" />
            <circle cx="830" cy="22" r="3.5" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="1.5" />
            <circle cx="970" cy="2" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="998" cy="30" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="998" cy="300" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="970" cy="598" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="620" cy="578" r="3.5" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="1.5" />
            <circle cx="480" cy="578" r="3.5" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="1.5" />
            <circle cx="30" cy="598" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="2" cy="570" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
            <circle cx="2" cy="300" r="4" fill="#E8E8E8" stroke="#6D4AFF" strokeWidth="2" />
          </svg>
        </div>

        {/* Content Card Box */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-4 sm:p-8 rounded-2xl bg-[#0A0A0A]/90">
          
          {/* Left Column — Hooded Figure Image with Violet Matrix Effect */}
          <div className="lg:col-span-6 flex justify-center items-center overflow-hidden rounded-xl bg-[#0F0F12] border border-white/5 shadow-2xl">
            <img
              src={hoodedHackerImg}
              alt="TRACE-X Security Architecture"
              className="w-full h-auto object-cover max-h-[500px] rounded-xl transform hover:scale-[1.01] transition-transform duration-500"
            />
          </div>

          {/* Right Column — Form & Authentication controls */}
          <div className="lg:col-span-6 space-y-5 px-2 sm:px-4">
            
            {/* Header & Subtitle */}
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                Log in to your account
              </h1>
              <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2">
                Use your work email to log in to your workplace
              </p>
            </div>

            {/* Error or Info Banner */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center space-x-2.5 text-rose-400 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3 bg-[#6D4AFF]/10 border border-[#6D4AFF]/20 rounded-lg flex items-center space-x-2.5 text-purple-300 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#6D4AFF]" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center space-x-3 bg-[#141414] hover:bg-[#1A1A1E] border border-white/12 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer text-sm shadow-sm"
            >
              {/* Google Multi-colored SVG G icon */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Log in with Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 h-[1px] bg-white/12" />
              <span className="px-3 text-xs text-[#8A8F98] font-normal">Or continue with email</span>
              <div className="flex-1 h-[1px] bg-white/12" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Email Address Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#D1D5DB]">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="s.t.sharkey@outlook.com"
                  className="w-full px-3.5 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-[#F2F2F2] placeholder-[#8A8F98] focus:outline-none focus:border-[#6D4AFF] focus:ring-1 focus:ring-[#6D4AFF] transition-all"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#D1D5DB]">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-[#6D4AFF] hover:text-[#7C5CFC] font-medium transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-[#F2F2F2] placeholder-[#8A8F98] focus:outline-none focus:border-[#6D4AFF] focus:ring-1 focus:ring-[#6D4AFF] transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8F98] hover:text-[#D1D5DB] transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mobile Quick Preset Row */}
              <div className="sm:hidden flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#8A8F98]">Presets:</span>
                <div className="flex space-x-1 text-[11px]">
                  <button type="button" onClick={() => selectPreset('admin@tracex.gov.in', 'AdminPass123!')} className="px-2 py-0.5 bg-[#141414] border border-white/10 rounded text-[#6D4AFF]">Admin</button>
                  <button type="button" onClick={() => selectPreset('priya.verma@tracex.gov.in', 'Investigator123!')} className="px-2 py-0.5 bg-[#141414] border border-white/10 rounded text-[#6D4AFF]">Investigator</button>
                  <button type="button" onClick={() => selectPreset('amit.patel@tracex.gov.in', 'Analyst123!')} className="px-2 py-0.5 bg-[#141414] border border-white/10 rounded text-[#6D4AFF]">Analyst</button>
                </div>
              </div>

              {/* Primary Log In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#6D4AFF] hover:bg-[#7C5CFC] text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-[#6D4AFF]/20 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? 'Authenticating...' : 'Log in'}
              </button>
            </form>

            {/* Signup Footer Link */}
            <p className="text-center text-xs text-[#8A8F98] pt-2">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={handleSignUp}
                className="text-[#6D4AFF] hover:text-[#7C5CFC] font-medium transition-colors cursor-pointer ml-1"
              >
                Sign up
              </button>
            </p>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-6xl mx-auto text-center pt-6 pb-2 text-[11px] text-[#8A8F98]">
        TRACE-X Forensic & Criminal Intelligence Platform &copy; 2026. Restricted Access.
      </div>
    </div>
  );
};

