import React, { useMemo } from 'react';

/**
 * CyberHudBackground
 * 
 * High-end cybersecurity intelligence workstation HUD background.
 * Inspired directly by the TRACE-X reference visual architecture:
 * - Concentric rotating rings with independent rotational speeds
 * - Segmented glowing arcs in Crimson Red (#DC2626) and Bright Magenta (#B026FF)
 * - 360-degree radar scanning arc sweep beam
 * - Circuit network traces with glowing data pulse vectors
 * - Peripheral HUD annotations (TRACE-X shield, ANALYZE/CORRELATE/INVESTIGATE, SYSTEM ONLINE)
 * - Strictly pointer-events-none, isolated from form interaction
 * - Unconditionally respects prefers-reduced-motion
 */
export interface CyberHudBackgroundProps {
  className?: string;
  variant?: 'login' | 'workstation' | 'minimal';
  showAnnotations?: boolean;
  fixed?: boolean;
  opacity?: number;
}

export const CyberHudBackground: React.FC<CyberHudBackgroundProps> = ({
  className = '',
  variant = 'login',
  showAnnotations,
  fixed = false,
  opacity,
}) => {
  const isWorkstation = variant === 'workstation';
  const displayAnnotations = showAnnotations !== undefined ? showAnnotations : !isWorkstation;

  // Generate tick marks for the outer compass ring (0 to 360 deg, step 3 deg)
  const ticks = useMemo(() => {
    const arr = [];
    for (let deg = 0; deg < 360; deg += 3) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 30 === 0;
      const isSemi = deg % 15 === 0 && !isMajor;
      const length = isMajor ? 14 : isSemi ? 8 : 4;
      const r1 = 455;
      const r2 = r1 - length;
      const x1 = 800 + r1 * Math.cos(rad);
      const y1 = 500 + r1 * Math.sin(rad);
      const x2 = 800 + r2 * Math.cos(rad);
      const y2 = 500 + r2 * Math.sin(rad);
      arr.push({ deg, x1, y1, x2, y2, isMajor, isSemi });
    }
    return arr;
  }, []);

  const positionClass = fixed ? 'fixed inset-0' : 'absolute inset-0';

  return (
    <div
      className={`${positionClass} pointer-events-none overflow-hidden select-none z-0 ${className}`}
      style={opacity !== undefined ? { opacity } : undefined}
      aria-hidden="true"
    >
      {/* Deep Workstation Canvas Base */}
      <div className={`absolute inset-0 ${isWorkstation ? 'bg-[#050509]/80' : 'bg-[#050509]'}`} />

      {/* Subtle Precision Cyber Grid */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 92, 246, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(220, 38, 38, 0.18) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Vignette Shadow Overlay (keeps peripheral dark and center focused) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,9,0.7)_70%,rgba(5,5,9,0.95)_100%)]" />

      {/* Main SVG Vector Stage (1600 x 1000 coordinate plane) */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Cyber Gradient Palette */}
          <linearGradient id="hud-grad-crimson-magenta" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="45%" stopColor="#B026FF" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>

          <linearGradient id="hud-grad-magenta-purple" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="60%" stopColor="#B026FF" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>

          <linearGradient id="hud-grad-bright-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.3" />
          </linearGradient>

          {/* Glowing Filters */}
          <filter id="hud-glow-intense" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="hud-glow-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Radial Sweep Gradient for Radar Beam */}
          <radialGradient id="hud-scan-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B026FF" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#DC2626" stopOpacity="0.10" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* -------------------------------------------------------------
            LAYER 1: Static Geometric Axes & Coordinate Crosshairs
            ------------------------------------------------------------- */}
        <g stroke="rgba(139, 92, 246, 0.12)" strokeWidth="1">
          {/* Horizontal Crosshair Axis */}
          <line x1="50" y1="500" x2="1550" y2="500" strokeDasharray="4 6" />
          {/* Vertical Crosshair Axis */}
          <line x1="800" y1="50" x2="800" y2="950" strokeDasharray="4 6" />
          {/* Diagonal Guides */}
          <line x1="200" y1="100" x2="1400" y2="900" stroke="rgba(220, 38, 38, 0.06)" strokeDasharray="2 8" />
          <line x1="200" y1="900" x2="1400" y2="100" stroke="rgba(139, 92, 246, 0.06)" strokeDasharray="2 8" />
        </g>

        {/* -------------------------------------------------------------
            LAYER 2: Circuit Network Traces with Flowing Data Pulses
            ------------------------------------------------------------- */}
        <g>
          {/* Left Wing Circuit Traces */}
          <path
            d="M 345,500 L 220,500 L 170,450 L 80,450"
            fill="none"
            stroke="rgba(220, 38, 38, 0.28)"
            strokeWidth="1.6"
          />
          <path
            d="M 345,500 L 220,500 L 170,450 L 80,450"
            fill="none"
            stroke="#EF4444"
            strokeWidth="2.2"
            strokeDasharray="14 110"
            className="animate-circuit-pulse"
          />

          <path
            d="M 370,550 L 260,550 L 210,620 L 110,620"
            fill="none"
            stroke="rgba(176, 38, 255, 0.25)"
            strokeWidth="1.6"
          />
          <path
            d="M 370,550 L 260,550 L 210,620 L 110,620"
            fill="none"
            stroke="#B026FF"
            strokeWidth="2.2"
            strokeDasharray="18 130"
            className="animate-circuit-pulse"
            style={{ animationDelay: '-1.5s' }}
          />

          <path
            d="M 400,380 L 280,380 L 230,310 L 130,310"
            fill="none"
            stroke="rgba(124, 58, 237, 0.25)"
            strokeWidth="1.6"
          />
          <path
            d="M 400,380 L 280,380 L 230,310 L 130,310"
            fill="none"
            stroke="#C084FC"
            strokeWidth="2"
            strokeDasharray="16 120"
            className="animate-circuit-pulse"
            style={{ animationDelay: '-0.8s' }}
          />

          {/* Right Wing Circuit Traces */}
          <path
            d="M 1255,500 L 1380,500 L 1430,450 L 1520,450"
            fill="none"
            stroke="rgba(176, 38, 255, 0.28)"
            strokeWidth="1.6"
          />
          <path
            d="M 1255,500 L 1380,500 L 1430,450 L 1520,450"
            fill="none"
            stroke="#B026FF"
            strokeWidth="2.2"
            strokeDasharray="14 110"
            className="animate-circuit-pulse"
            style={{ animationDelay: '-2s' }}
          />

          <path
            d="M 1230,550 L 1340,550 L 1390,620 L 1490,620"
            fill="none"
            stroke="rgba(220, 38, 38, 0.25)"
            strokeWidth="1.6"
          />
          <path
            d="M 1230,550 L 1340,550 L 1390,620 L 1490,620"
            fill="none"
            stroke="#EF4444"
            strokeWidth="2.2"
            strokeDasharray="18 130"
            className="animate-circuit-pulse"
            style={{ animationDelay: '-0.4s' }}
          />

          <path
            d="M 1200,380 L 1320,380 L 1370,310 L 1470,310"
            fill="none"
            stroke="rgba(124, 58, 237, 0.25)"
            strokeWidth="1.6"
          />
          <path
            d="M 1200,380 L 1320,380 L 1370,310 L 1470,310"
            fill="none"
            stroke="#C084FC"
            strokeWidth="2"
            strokeDasharray="16 120"
            className="animate-circuit-pulse"
            style={{ animationDelay: '-2.7s' }}
          />

          {/* Circuit Elbow Nodes with Glow */}
          <circle cx="220" cy="500" r="3.5" fill="#EF4444" className="animate-node-pulse-glow" />
          <circle cx="170" cy="450" r="3" fill="#EF4444" />
          <circle cx="80" cy="450" r="4" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />

          <circle cx="260" cy="550" r="3.5" fill="#B026FF" className="animate-node-pulse-glow" />
          <circle cx="210" cy="620" r="3" fill="#B026FF" />
          <circle cx="110" cy="620" r="4" fill="#7C3AED" stroke="#FFFFFF" strokeWidth="1" />

          <circle cx="1380" cy="500" r="3.5" fill="#B026FF" className="animate-node-pulse-glow" />
          <circle cx="1430" cy="450" r="3" fill="#B026FF" />
          <circle cx="1520" cy="450" r="4" fill="#B026FF" stroke="#FFFFFF" strokeWidth="1" />

          <circle cx="1340" cy="550" r="3.5" fill="#EF4444" className="animate-node-pulse-glow" />
          <circle cx="1390" cy="620" r="3" fill="#EF4444" />
          <circle cx="1490" cy="620" r="4" fill="#DC2626" stroke="#FFFFFF" strokeWidth="1" />
        </g>

        {/* -------------------------------------------------------------
            LAYER 3: Rotating Concentric Cyber HUD Rings
            ------------------------------------------------------------- */}

        {/* Ring A: Outer Compass Scale Ring (Slow Clockwise Rotation ~48s) */}
        <g className="animate-hud-rotate-cw">
          {/* Main Ring Line */}
          <circle
            cx="800"
            cy="500"
            r="455"
            fill="none"
            stroke="rgba(139, 92, 246, 0.28)"
            strokeWidth="1.5"
          />
          {/* Secondary Concentric Outline */}
          <circle
            cx="800"
            cy="500"
            r="468"
            fill="none"
            stroke="rgba(220, 38, 38, 0.18)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />

          {/* Compass Ticks */}
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                t.isMajor
                  ? '#B026FF'
                  : t.isSemi
                  ? 'rgba(220, 38, 38, 0.65)'
                  : 'rgba(139, 92, 246, 0.35)'
              }
              strokeWidth={t.isMajor ? 1.8 : 1}
            />
          ))}

          {/* Cardinal Coordinate Labels */}
          <text x="800" y="40" fill="#B026FF" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity="0.85">000° // NORTH</text>
          <text x="1285" y="504" fill="#EF4444" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="start" opacity="0.85">090° // EAST</text>
          <text x="800" y="975" fill="#B026FF" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="middle" opacity="0.85">180° // SOUTH</text>
          <text x="315" y="504" fill="#EF4444" fontSize="10" fontFamily="'JetBrains Mono', monospace" textAnchor="end" opacity="0.85">270° // WEST</text>
        </g>

        {/* Ring B: Segmented Glowing Arc Ring (Counter-Clockwise ~32s) */}
        <g className="animate-hud-rotate-ccw">
          {/* Segmented Arc: Upper Left Crimson Red Segment */}
          <path
            d="M 531,231 A 380 380 0 0 1 800,120"
            fill="none"
            stroke="#DC2626"
            strokeWidth="4"
            filter="url(#hud-glow-intense)"
            opacity="0.9"
          />
          <path
            d="M 531,231 A 380 380 0 0 1 800,120"
            fill="none"
            stroke="#FCA5A5"
            strokeWidth="1.5"
            opacity="0.9"
          />

          {/* Segmented Arc: Upper Right Magenta Segment */}
          <path
            d="M 880,128 A 380 380 0 0 1 1130,310"
            fill="none"
            stroke="#B026FF"
            strokeWidth="4.5"
            filter="url(#hud-glow-intense)"
            opacity="0.95"
          />
          <path
            d="M 880,128 A 380 380 0 0 1 1130,310"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.6"
            opacity="0.85"
          />

          {/* Segmented Arc: Bottom Right Purple Segment */}
          <path
            d="M 1130,690 A 380 380 0 0 1 800,880"
            fill="none"
            stroke="#7C3AED"
            strokeWidth="3.5"
            filter="url(#hud-glow-soft)"
            opacity="0.75"
          />

          {/* Segmented Arc: Bottom Left Crimson Accent Segment */}
          <path
            d="M 720,873 A 380 380 0 0 1 470,690"
            fill="none"
            stroke="#EF4444"
            strokeWidth="3.5"
            filter="url(#hud-glow-soft)"
            opacity="0.85"
          />

          {/* Dotted Segmented Track */}
          <circle
            cx="800"
            cy="500"
            r="380"
            fill="none"
            stroke="rgba(139, 92, 246, 0.2)"
            strokeWidth="1.5"
            strokeDasharray="2 12"
          />
        </g>

        {/* Ring C: Telemetry Coordinate Track (Slow Clockwise ~64s) */}
        <g className="animate-hud-rotate-slow">
          <circle
            cx="800"
            cy="500"
            r="315"
            fill="none"
            stroke="rgba(176, 38, 255, 0.22)"
            strokeWidth="1.2"
            strokeDasharray="18 8 4 8"
          />
          <circle
            cx="800"
            cy="500"
            r="295"
            fill="none"
            stroke="rgba(220, 38, 38, 0.2)"
            strokeWidth="1"
            strokeDasharray="8 16"
          />

          {/* Glowing Track Nodes */}
          <circle cx="1115" cy="500" r="3.5" fill="#EF4444" filter="url(#hud-glow-soft)" />
          <circle cx="800" cy="815" r="3.5" fill="#B026FF" filter="url(#hud-glow-soft)" />
          <circle cx="485" cy="500" r="3.5" fill="#EF4444" filter="url(#hud-glow-soft)" />
          <circle cx="800" cy="185" r="3.5" fill="#B026FF" filter="url(#hud-glow-soft)" />
        </g>

        {/* Ring D: Targeting Reticle & Inner Rings */}
        <g>
          <circle
            cx="800"
            cy="500"
            r="230"
            fill="none"
            stroke="rgba(139, 92, 246, 0.28)"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          <circle
            cx="800"
            cy="500"
            r="160"
            fill="none"
            stroke="rgba(220, 38, 38, 0.25)"
            strokeWidth="1"
          />
          <circle
            cx="800"
            cy="500"
            r="100"
            fill="none"
            stroke="rgba(176, 38, 255, 0.3)"
            strokeWidth="1.2"
            strokeDasharray="3 9"
          />

          {/* Central Target Center Dot */}
          <circle cx="800" cy="500" r="3" fill="#EF4444" filter="url(#hud-glow-intense)" />
        </g>

        {/* -------------------------------------------------------------
            LAYER 4: Radar Scanning Arc Sweep Beam (Continuous 8s Rotation)
            ------------------------------------------------------------- */}
        <g className="animate-hud-scan">
          {/* Conic Sweep Fan Path */}
          <path
            d="M 800,500 L 1250,500 A 450 450 0 0 1 1150,780 Z"
            fill="url(#hud-scan-radial)"
            opacity="0.75"
          />
          {/* Leading Laser Sweep Line */}
          <line
            x1="800"
            y1="500"
            x2="1250"
            y2="500"
            stroke="#B026FF"
            strokeWidth="1.8"
            filter="url(#hud-glow-soft)"
            opacity="0.85"
          />
        </g>
      </svg>

      {/* -------------------------------------------------------------
          LAYER 5: Peripheral HUD Telemetry Annotations (Matching Reference)
          ------------------------------------------------------------- */}
      {displayAnnotations && (
        <div className="absolute inset-0 p-6 sm:p-10 lg:p-12 flex flex-col justify-between font-mono pointer-events-none">
          
          {/* Top Annotation Bar */}
          <div className="flex items-start justify-between w-full">
            {/* Top Left: TRACE-X Shield Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#7C3AED] p-0.5 shadow-[0_0_18px_rgba(176,38,255,0.45)]">
                <div className="w-full h-full bg-[#0D0A12] rounded-[10px] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#EF4444]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 4.5c1.93 0 3.5 1.57 3.5 3.5 0 1.93-1.57 3.5-3.5 3.5S8.5 11.93 8.5 10c0-1.93 1.57-3.5 3.5-3.5z" />
                  </svg>
                </div>
              </div>
              <div>
                <span className="text-lg font-bold tracking-widest text-[#F5F5F5] block font-sans">
                  TRACE<span className="text-[#B026FF]">-</span>X
                </span>
                <span className="text-[9px] text-[#A1A1AA] tracking-wider uppercase block">
                  Forensic Workstation
                </span>
              </div>
            </div>

            {/* Top Right: System Title Banner */}
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                AI-POWERED CRIMINAL NETWORK & INVESTIGATION INTELLIGENCE SYSTEM
              </p>
              <p className="text-[9px] text-[#71717A] tracking-widest uppercase mt-0.5">
                RESTRICTED WORKSPACE // CITADEL PROTOCOL
              </p>
            </div>
          </div>

          {/* Middle Flank Telemetry Stacks */}
          <div className="flex items-center justify-between w-full my-auto py-12">
            {/* Left Flank Stack */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="w-1 h-20 bg-gradient-to-b from-[#DC2626] via-[#B026FF] to-transparent rounded-full shadow-[0_0_10px_rgba(220,38,38,0.7)]" />
              <div className="space-y-1.5 text-[11px] tracking-widest text-slate-400 font-semibold">
                <div className="hover:text-white transition-colors flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                  <span>ANALYZE</span>
                </div>
                <div className="hover:text-white transition-colors flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B026FF]" />
                  <span>CORRELATE</span>
                </div>
                <div className="hover:text-white transition-colors flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                  <span>INVESTIGATE</span>
                </div>
                <div className="hover:text-white transition-colors flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span>REPORT</span>
                </div>
              </div>
            </div>

            {/* Right Flank Stack */}
            <div className="hidden md:flex items-center space-x-3 text-right ml-auto">
              <div className="space-y-1.5 text-[11px] tracking-widest text-slate-400 font-semibold">
                <div className="hover:text-white transition-colors flex items-center justify-end space-x-1.5">
                  <span>EVIDENCE</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                </div>
                <div className="hover:text-white transition-colors flex items-center justify-end space-x-1.5">
                  <span>ENTITIES</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B026FF]" />
                </div>
                <div className="hover:text-white transition-colors flex items-center justify-end space-x-1.5">
                  <span>RELATIONSHIPS</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]" />
                </div>
                <div className="hover:text-white transition-colors flex items-center justify-end space-x-1.5">
                  <span>INTELLIGENCE</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                </div>
              </div>
              <div className="w-1 h-20 bg-gradient-to-b from-[#7C3AED] via-[#B026FF] to-transparent rounded-full shadow-[0_0_10px_rgba(176,38,255,0.7)]" />
            </div>
          </div>

          {/* Bottom Annotation Bar */}
          <div className="flex items-end justify-between w-full text-[10px] tracking-wider text-slate-400">
            {/* Bottom Left: System Online Status */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-[#EF4444] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-status-red-purple" />
                <span>SYSTEM ONLINE</span>
              </div>
              <div className="text-[#71717A]">
                TRACE-X v1.0.0 // LAT: 28.6139° N, LON: 77.2090° E
              </div>
            </div>

            {/* Bottom Right: Security Triad */}
            <div className="text-right hidden sm:block text-[#A1A1AA]">
              <span className="text-[#B026FF] font-semibold">SECURE</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-[#F5F5F5] font-semibold">INTELLIGENT</span>
              <span className="mx-2 text-slate-600">|</span>
              <span className="text-[#DC2626] font-semibold">TRUSTED</span>
            </div>
          </div>

        </div>
      )}

      {/* Workstation Minimal Peripheral Telemetry */}
      {isWorkstation && !displayAnnotations && (
        <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between font-mono pointer-events-none opacity-40">
          <div className="flex justify-between items-center text-[9px] text-[#A1A1AA]">
            <span className="tracking-widest">WORKSTATION HUD // RADAR ACTIVE</span>
            <span className="tracking-widest">LAT 28.6139° N // LON 77.2090° E</span>
          </div>
          <div className="flex justify-between items-center text-[9px] text-[#A1A1AA]">
            <span className="tracking-widest">TRACE-X // CITADEL CORE</span>
            <span className="tracking-widest">SECURE // ENCRYPTED NODE</span>
          </div>
        </div>
      )}
    </div>
  );
};
