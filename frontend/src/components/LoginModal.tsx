import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, AlertCircle, Mail, Lock } from 'lucide-react';
import { apiClient, unwrapData } from '../api/client';
import hoodedHackerImg from '../assets/hooded-hacker.jpg';
import { CyberHudBackground } from './CyberHudBackground';

interface LoginModalProps {
  onLoginSuccess: (user: any, token: string) => void;
}

/**
 * Lightweight, atmospheric cyber particles canvas
 * Renders small, slow-moving telemetry/data nodes with faint connecting lines
 * Automatically respects prefers-reduced-motion
 */
const CyberParticlesCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Red -> Magenta -> Purple cybersecurity palette nodes
    const colors = [
      'rgba(220, 38, 38, 0.45)',   // Crimson red #DC2626
      'rgba(176, 38, 255, 0.5)',   // Red-purple transition #B026FF
      'rgba(124, 58, 237, 0.45)',  // Primary purple #7C3AED
      'rgba(139, 92, 246, 0.4)',   // Bright purple #8B5CF6
    ];

    const count = 28; // Subtle, discrete atmospheric count
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22, // Very slow, calm velocity
      vy: (Math.random() - 0.5) * 0.22,
      radius: Math.random() * 1.2 + 0.8,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw faint connections between nearby nodes
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 95) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(176, 38, 255, ${0.07 * (1 - dist / 95)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw and update particle telemetry points
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          else if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          else if (p.y > height) p.y = 0;
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};

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
      const data = (unwrapData<{ user: any; token: string }>(res.data) || res.data) as any;
      const user = data?.user || res.data?.user;
      const token = data?.token || res.data?.token;
      if (token) {
        localStorage.setItem('tracex_jwt_token', token);
      }
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
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#050509] text-[#F5F5F5] font-sans min-h-screen overflow-y-auto p-4 sm:p-6 lg:p-10 select-none relative">
      
      {/* Large Animated Rotating Cyber HUD Background Layer */}
      <CyberHudBackground />

      {/* Atmospheric Background Telemetry Particles */}
      <CyberParticlesCanvas />

      {/* Foreground Top Bar with Demo Account Quick Presets */}
      <div className="w-full max-w-6xl mx-auto flex items-center justify-end pt-2 pb-2 relative z-20">
        <div className="hidden sm:flex items-center space-x-2 bg-[#0D0A12]/90 border border-[rgba(139,92,246,0.25)] p-1 rounded-xl text-xs shadow-lg backdrop-blur-md">
          <span className="px-2 text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wider font-mono">Demo Accounts:</span>
          <button
            type="button"
            onClick={() => selectPreset('admin@tracex.gov.in', 'AdminPass123!')}
            className={`px-2.5 py-1 rounded-lg transition-all font-mono text-xs cursor-pointer ${
              email === 'admin@tracex.gov.in'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.35)]'
                : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => selectPreset('priya.verma@tracex.gov.in', 'Investigator123!')}
            className={`px-2.5 py-1 rounded-lg transition-all font-mono text-xs cursor-pointer ${
              email === 'priya.verma@tracex.gov.in'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.35)]'
                : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Investigator
          </button>
          <button
            type="button"
            onClick={() => selectPreset('amit.patel@tracex.gov.in', 'Analyst123!')}
            className={`px-2.5 py-1 rounded-lg transition-all font-mono text-xs cursor-pointer ${
              email === 'amit.patel@tracex.gov.in'
                ? 'bg-gradient-to-r from-[#DC2626] to-[#7C3AED] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.35)]'
                : 'text-[#A1A1AA] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Analyst
          </button>
        </div>
      </div>

      {/* Main Centered Circuit Card Container */}
      <div className="w-full max-w-5xl mx-auto my-auto relative z-10">
        
        {/* Slow-moving Ambient Glow Behind the Login Panel */}
        <div className="absolute -inset-10 sm:-inset-16 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5B21B6]/28 rounded-full blur-[110px] animate-cyber-ambient-glow" />
          <div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#DC2626]/20 rounded-full blur-[120px] animate-cyber-ambient-glow"
            style={{ animationDelay: '-4s' }}
          />
        </div>

        {/* Decorative Circuit Border (SVG) with Red -> Purple Palette & Animated Sweep */}
        <div className="absolute -inset-4 sm:-inset-6 pointer-events-none z-0">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 1000 600"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Red to Purple Gradient Definition */}
              <linearGradient id="cyber-red-purple-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#DC2626" />
                <stop offset="45%" stopColor="#B026FF" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>

              {/* Mixed Red/Purple Glow Filter */}
              <filter id="cyber-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Base Chamfered Circuit Path */}
            <path
              d="M 30,2 L 670,2 L 690,22 L 830,22 L 850,2 L 970,2 L 998,30 L 998,570 L 970,598 L 640,598 L 620,578 L 480,578 L 460,598 L 30,598 L 2,570 L 2,30 Z"
              fill="none"
              stroke="url(#cyber-red-purple-grad)"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
              filter="url(#cyber-glow-filter)"
              opacity="0.85"
            />

            {/* Subtle Animated Circuit-Line Trace Sweep */}
            <path
              d="M 30,2 L 670,2 L 690,22 L 830,22 L 850,2 L 970,2 L 998,30 L 998,570 L 970,598 L 640,598 L 620,578 L 480,578 L 460,598 L 30,598 L 2,570 L 2,30 Z"
              fill="none"
              stroke="#F5F5F5"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
              className="animate-circuit-sweep"
              opacity="0.8"
            />

            {/* Glowing Circuit Node Dots with Alternating Red / Purple Finishes */}
            <circle cx="30" cy="2" r="4" fill="#F5F5F5" stroke="#DC2626" strokeWidth="2" />
            <circle cx="690" cy="22" r="3.5" fill="#F5F5F5" stroke="#B026FF" strokeWidth="1.5" />
            <circle cx="830" cy="22" r="3.5" fill="#F5F5F5" stroke="#B026FF" strokeWidth="1.5" />
            <circle cx="970" cy="2" r="4" fill="#F5F5F5" stroke="#7C3AED" strokeWidth="2" />
            <circle cx="998" cy="30" r="4" fill="#F5F5F5" stroke="#7C3AED" strokeWidth="2" />
            <circle cx="998" cy="300" r="4" fill="#F5F5F5" stroke="#B026FF" strokeWidth="2" />
            <circle cx="970" cy="598" r="4" fill="#F5F5F5" stroke="#DC2626" strokeWidth="2" />
            <circle cx="620" cy="578" r="3.5" fill="#F5F5F5" stroke="#DC2626" strokeWidth="1.5" />
            <circle cx="480" cy="578" r="3.5" fill="#F5F5F5" stroke="#B026FF" strokeWidth="1.5" />
            <circle cx="30" cy="598" r="4" fill="#F5F5F5" stroke="#7C3AED" strokeWidth="2" />
            <circle cx="2" cy="570" r="4" fill="#F5F5F5" stroke="#7C3AED" strokeWidth="2" />
            <circle cx="2" cy="300" r="4" fill="#F5F5F5" stroke="#DC2626" strokeWidth="2" />
          </svg>
        </div>

        {/* Content Card Box with #111019 Panel and Red-Purple Borders */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-4 sm:p-8 rounded-2xl bg-[#111019]/95 backdrop-blur-md border border-[rgba(139,92,246,0.25)] shadow-[0_0_35px_rgba(91,33,182,0.2),0_0_15px_rgba(220,38,38,0.1)]">
          
          {/* Left Column — Hooded Figure Image with Red-Purple Cyber Lighting & Sweep */}
          <div className="lg:col-span-6 flex justify-center items-center overflow-hidden rounded-xl bg-[#0D0A12] border border-[rgba(139,92,246,0.22)] shadow-2xl relative group">
            
            {/* Gentle Animated Gradient Lighting Behind Image */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute -top-10 -left-10 w-64 h-64 bg-[#DC2626]/20 rounded-full blur-3xl animate-cyber-ambient-glow" />
              <div
                className="absolute -bottom-10 -right-10 w-64 h-64 bg-[#7C3AED]/25 rounded-full blur-3xl animate-cyber-ambient-glow"
                style={{ animationDelay: '-3.5s' }}
              />
            </div>

            {/* Main Character Graphic */}
            <img
              src={hoodedHackerImg}
              alt="TRACE-X Security Architecture"
              className="relative z-10 w-full h-auto object-cover max-h-[500px] rounded-xl transform hover:scale-[1.01] transition-transform duration-500 filter contrast-[1.02]"
            />

            {/* Soft Scanning / Light Sweep Effect Across Cyber Frame */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl">
              <div className="w-full h-24 bg-gradient-to-b from-transparent via-[rgba(176,38,255,0.12)] to-transparent animate-cyber-sweep" />
            </div>

            {/* Subtle Vignette Overlay */}
            <div className="absolute inset-0 rounded-xl border border-[rgba(139,92,246,0.15)] pointer-events-none z-20 shadow-[inset_0_0_20px_rgba(13,10,18,0.85)]" />
          </div>

          {/* Right Column — Form & Authentication controls */}
          <div className="lg:col-span-6 space-y-5 px-2 sm:px-4 relative z-10">
            
            {/* Header & Subtitle */}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-status-red-purple" />
                <span className="text-[10px] font-mono tracking-widest text-[#B026FF] uppercase">
                  CLASSIFIED // RESTRICTED ACCESS
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#F5F5F5]">
                Log in to your account
              </h1>
              <p className="text-xs sm:text-sm text-[#A1A1AA] mt-2">
                Use your work email to log in to your workplace
              </p>
            </div>

            {/* Error or Info Banner */}
            {error && (
              <div className="p-3 bg-rose-950/40 border border-[#DC2626]/40 rounded-lg flex items-center space-x-2.5 text-rose-300 text-xs sm:text-sm shadow-[0_0_12px_rgba(220,38,38,0.15)]">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#EF4444]" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3 bg-[#5B21B6]/20 border border-[rgba(139,92,246,0.3)] rounded-lg flex items-center space-x-2.5 text-purple-200 text-xs sm:text-sm shadow-[0_0_12px_rgba(124,58,237,0.15)]">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#B026FF]" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center space-x-3 bg-[#0D0A12] hover:bg-[#16131F] border border-[rgba(139,92,246,0.22)] hover:border-[rgba(139,92,246,0.45)] text-[#F5F5F5] font-medium py-3 px-4 rounded-lg transition-all cursor-pointer text-sm shadow-sm"
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
              <div className="flex-1 h-[1px] bg-[rgba(139,92,246,0.2)]" />
              <span className="px-3 text-xs text-[#A1A1AA] font-normal">Or continue with email</span>
              <div className="flex-1 h-[1px] bg-[rgba(139,92,246,0.2)]" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Email Address Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#D1D5DB]">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="s.t.sharkey@outlook.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#08070B]/90 border border-[rgba(139,92,246,0.25)] rounded-lg text-sm text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#DC2626]/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.2)] transition-all font-sans"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#D1D5DB]">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-[#C026D3] hover:text-[#DC2626] font-medium transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#08070B]/90 border border-[rgba(139,92,246,0.25)] rounded-lg text-sm text-[#F5F5F5] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#DC2626]/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.2)] transition-all font-sans"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mobile Quick Preset Row */}
              <div className="sm:hidden flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#A1A1AA]">Presets:</span>
                <div className="flex space-x-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => selectPreset('admin@tracex.gov.in', 'AdminPass123!')}
                    className="px-2 py-0.5 bg-[#0D0A12] border border-[rgba(139,92,246,0.2)] rounded text-[#B026FF]"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPreset('priya.verma@tracex.gov.in', 'Investigator123!')}
                    className="px-2 py-0.5 bg-[#0D0A12] border border-[rgba(139,92,246,0.2)] rounded text-[#B026FF]"
                  >
                    Investigator
                  </button>
                  <button
                    type="button"
                    onClick={() => selectPreset('amit.patel@tracex.gov.in', 'Analyst123!')}
                    className="px-2 py-0.5 bg-[#0D0A12] border border-[rgba(139,92,246,0.2)] rounded text-[#B026FF]"
                  >
                    Analyst
                  </button>
                </div>
              </div>

              {/* Primary Log In Button with Red -> Purple Gradient & Ambient Pulse */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-[#DC2626] via-[#B026FF] to-[#7C3AED] hover:from-[#EF4444] hover:via-[#C026D3] hover:to-[#8B5CF6] text-white text-sm font-semibold rounded-lg transition-all shadow-lg animate-btn-pulse cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Authenticating...' : 'Log in'}</span>
                {!loading && <span>&rarr;</span>}
              </button>
            </form>

            {/* Signup Footer Link */}
            <p className="text-center text-xs text-[#A1A1AA] pt-2">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={handleSignUp}
                className="text-[#C026D3] hover:text-[#DC2626] font-medium transition-colors cursor-pointer ml-1"
              >
                Sign up
              </button>
            </p>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-6xl mx-auto text-center pt-6 pb-2 text-[11px] text-[#A1A1AA] relative z-10">
        TRACE-X Forensic & Criminal Intelligence Platform &copy; 2026. Restricted Access.
      </div>
    </div>
  );
};

