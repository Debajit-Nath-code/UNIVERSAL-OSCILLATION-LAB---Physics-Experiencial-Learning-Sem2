/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Home, 
  Grid, 
  Settings, 
  User, 
  ArrowRight, 
  ChevronDown, 
  Plus,
  Activity,
  Timer,
  Zap,
  Waves,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  Info,
  Battery,
  Trophy,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { MODULES, ModuleType, ModuleInfo } from './types';
import { 
  stepRK4, 
  stepRK4Double,
  massSpringAccel, 
  pendulumAccel, 
  pendulumSmallAngleAccel,
  forcedAccel, 
  calculateResonanceAmplitude,
  SimulationState,
  DoublePendulumState
} from './PhysicsEngine';

// --- Types ---

interface SimulationParams {
  mass: number;
  k: number;
  damping: number;
  length: number;
  gravity: number;
  gravityPreset: 'earth' | 'moon' | 'mars';
  f0: number;
  wd: number;
  numOscillators: number;
  initialAngle: number;
  showSmallAngle: boolean;
  isDoublePendulum: boolean;
  waveType: 'transverse' | 'longitudinal';
  waveAmplitude: number;
  wavePhase: number;
}

// --- Components ---

const NeumorphicButton = ({ children, className = "", onClick = () => {} }: { children: React.ReactNode, className?: string, onClick?: () => void }) => {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <button
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={onClick}
      className={`
        px-6 py-2 rounded-full font-bold transition-all duration-200
        ${isPressed ? 'shadow-neu-button-pressed scale-95' : 'shadow-neu-button hover:scale-105'}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

const NavButton = ({ icon: Icon, active = false }: { icon: any, active?: boolean }) => {
  return (
    <button className={`
      w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
      ${active ? 'shadow-neu-button-pressed bg-white/10' : 'shadow-neu-button hover:bg-white/5'}
    `}>
      <Icon size={24} className={active ? 'text-white' : 'text-white/60'} />
    </button>
  );
};

const PhysicsCard = ({ title, description, icon: Icon, image }: { title: string, description: string, icon?: any, image?: string }) => {
  return (
    <motion.div 
      whileHover={{ scale: 1.03, y: -5 }}
      className="glass-card rounded-3xl p-6 shadow-neu-flat relative overflow-hidden group"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-neu-button">
            <ArrowRight size={20} />
          </div>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">{description}</p>
      </div>
      {image && (
        <img 
          src={image} 
          alt={title} 
          className="absolute -bottom-4 -right-4 w-32 h-32 object-cover opacity-20 group-hover:opacity-40 transition-opacity"
          referrerPolicy="no-referrer"
        />
      )}
    </motion.div>
  );
};

// --- Simulation Logic (Simple Spring) ---

const ControlSlider = ({ label, min, max, step, unit, value, onChange, description }: { 
  label: string, min: number, max: number, step: number, unit: string, value: number, onChange: (v: number) => void, description?: string
}) => {
  return (
    <div className="space-y-3 group" title={description}>
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-white/50 group-hover:text-white/80 transition-colors">{label}</label>
        <span className="text-[10px] font-mono text-white bg-white/10 px-2 py-1 rounded-md shadow-neu-inset">
          {value.toFixed(2)} {unit}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="cosmic-slider w-full" 
      />
    </div>
  );
};

const SimulationModule = ({ type, isPaused, params }: { type: ModuleType, isPaused: boolean, params: SimulationParams }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SimulationState>({ x: 1.0, v: 0, t: 0 });
  const smallAngleStateRef = useRef<SimulationState>({ x: 1.0, v: 0, t: 0 });
  const doubleStateRef = useRef<DoublePendulumState>({ theta1: 0.8, omega1: 0, theta2: 0.8, omega2: 0, t: 0 });
  const waveStatesRef = useRef<SimulationState[]>([]);

  useEffect(() => {
    const handleReset = () => {
      const initX = type === 'pendulum' ? params.initialAngle : 1.0;
      stateRef.current = { x: initX, v: 0, t: 0 };
      smallAngleStateRef.current = { x: initX, v: 0, t: 0 };
      doubleStateRef.current = { theta1: initX, omega1: 0, theta2: initX, omega2: 0, t: 0 };
      if (type === 'waves') {
        waveStatesRef.current = Array.from({ length: params.numOscillators }, (_, i) => ({ x: 0, v: 0, t: 0 }));
      }
    };
    window.addEventListener('reset-sim', handleReset);
    handleReset();
    return () => window.removeEventListener('reset-sim', handleReset);
  }, [type, params.numOscillators, params.initialAngle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const dt = 0.016;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      if (!isPaused) {
        if (type === 'mass-spring' || type === 'energy') {
          stateRef.current = stepRK4(stateRef.current, dt, massSpringAccel({ m: params.mass, k: params.k, b: params.damping }));
        } else if (type === 'pendulum') {
          if (params.isDoublePendulum) {
            doubleStateRef.current = stepRK4Double(doubleStateRef.current, dt, { L1: params.length, L2: params.length, m1: params.mass, m2: params.mass, g: params.gravity });
          } else {
            stateRef.current = stepRK4(stateRef.current, dt, pendulumAccel({ L: params.length, g: params.gravity, b: params.damping }));
            if (params.showSmallAngle) {
              smallAngleStateRef.current = stepRK4(smallAngleStateRef.current, dt, pendulumSmallAngleAccel({ L: params.length, g: params.gravity, b: params.damping }));
            }
          }
        } else if (type === 'resonance') {
          stateRef.current = stepRK4(stateRef.current, dt, forcedAccel({ m: params.mass, k: params.k, b: params.damping, F0: params.f0, wd: params.wd }));
        } else if (type === 'waves') {
          const k_couple = 50;
          waveStatesRef.current = waveStatesRef.current.map((s, i) => {
            const driving = i === 0 ? params.waveAmplitude * Math.sin(params.wd * s.t + params.wavePhase) : 0;
            const left = i > 0 ? waveStatesRef.current[i-1].x : s.x;
            const right = i < waveStatesRef.current.length - 1 ? waveStatesRef.current[i+1].x : s.x;
            const accel = (driving + k_couple * (left - s.x) + k_couple * (right - s.x) - params.damping * s.v) / params.mass;
            return stepRK4(s, dt, () => accel);
          });
        }
      }

      ctx.save();
      ctx.translate(width / 2, height / 2);

      if (type === 'mass-spring' || type === 'energy' || type === 'resonance') {
        const x_px = stateRef.current.x * 60;
        const ceilingY = type === 'resonance' ? Math.sin(params.wd * stateRef.current.t) * 20 : 0;
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -150 + ceilingY);
        const segments = 20;
        const springLen = 150 + x_px - ceilingY;
        for (let i = 0; i <= segments; i++) {
          const sy = -150 + ceilingY + (i / segments) * springLen;
          const sx = i === 0 || i === segments ? 0 : (i % 2 === 0 ? 15 : -15);
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();

        if (type === 'resonance') {
          ctx.fillStyle = 'rgba(196, 181, 253, 0.3)';
          ctx.beginPath(); ctx.arc(0, -150 + ceilingY, 10, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = 'white';
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'white';
        ctx.beginPath();
        ctx.roundRect(-30, -150 + springLen, 60, 60, 12);
        ctx.fill();
      } else if (type === 'pendulum') {
        if (params.isDoublePendulum) {
          const { theta1, theta2 } = doubleStateRef.current;
          const L1 = params.length * 80;
          const L2 = params.length * 80;
          const x1 = Math.sin(theta1) * L1;
          const y1 = Math.cos(theta1) * L1 - 80;
          const x2 = x1 + Math.sin(theta2) * L2;
          const y2 = y1 + Math.cos(theta2) * L2;

          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.beginPath(); ctx.arc(x1, y1, 15, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x2, y2, 15, 0, Math.PI * 2); ctx.fill();
        } else {
          const angle = stateRef.current.x;
          const L_px = params.length * 80;
          const bx = Math.sin(angle) * L_px;
          const by = Math.cos(angle) * L_px - 80;

          if (params.showSmallAngle) {
            const angleSmall = smallAngleStateRef.current.x;
            const bxS = Math.sin(angleSmall) * L_px;
            const byS = Math.cos(angleSmall) * L_px - 80;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(bxS, byS); ctx.stroke();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath(); ctx.arc(bxS, byS, 15, 0, Math.PI * 2); ctx.fill();
          }

          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(bx, by); ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'white';
          ctx.beginPath(); ctx.arc(bx, by, 25, 0, Math.PI * 2); ctx.fill();
        }
      } else if (type === 'waves') {
        ctx.translate(-width/2 + 50, 0);
        const spacing = (width - 100) / params.numOscillators;
        waveStatesRef.current.forEach((s, i) => {
          const x_base = i * spacing;
          let x = x_base;
          let y = 0;

          if (params.waveType === 'transverse') {
            y = s.x * 40;
          } else {
            x = x_base + s.x * 40;
          }

          if (i > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            const prevS = waveStatesRef.current[i-1];
            const px = (i-1) * spacing + (params.waveType === 'longitudinal' ? prevS.x * 40 : 0);
            const py = (params.waveType === 'transverse' ? prevS.x * 40 : 0);
            ctx.moveTo(px, py);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
          ctx.fillStyle = i === 0 ? '#c4b5fd' : 'white';
          ctx.beginPath(); ctx.arc(x, y, i === 0 ? 6 : 3, 0, Math.PI * 2); ctx.fill();
        });

        // Wave Info Overlay
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px monospace';
        const k_couple = 50;
        const speed = Math.sqrt(k_couple / params.mass) * spacing / 40; // simplified speed
        const wavelength = speed / (params.wd / (2 * Math.PI));
        ctx.fillText(`Wavelength: ${wavelength.toFixed(2)} m`, 20, height - 40);
        ctx.fillText(`Wave Speed: ${speed.toFixed(2)} m/s`, 20, height - 25);
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [type, isPaused, params]);

  return (
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={500} 
        className="w-full h-full object-contain"
      />
      {type === 'energy' && (
        <div className="absolute bottom-4 left-4 right-4 glass-card p-6 rounded-[2rem] shadow-neu-flat z-20 border border-white/5">
          <EnergyDisplay module={type} isPaused={isPaused} params={params} horizontal />
        </div>
      )}
    </div>
  );
};

function RealTimeGraph({ type, module, isPaused, params }: { type: string, module: string, isPaused: boolean, params: SimulationParams }) {
  const [data, setData] = useState<any[]>([]);
  const stateRef = useRef<SimulationState>({ x: module === 'pendulum' ? params.initialAngle : 1.0, v: 0, t: 0 });

  useEffect(() => {
    const handleReset = () => {
      stateRef.current = { x: module === 'pendulum' ? params.initialAngle : 1.0, v: 0, t: 0 };
      setData([]);
    };
    window.addEventListener('reset-sim', handleReset);
    handleReset();
    return () => window.removeEventListener('reset-sim', handleReset);
  }, [module, params.initialAngle]);

  useEffect(() => {
    if (type === 'resonance-curve') {
      const curveData = [];
      for (let w = 0.1; w <= 10; w += 0.1) {
        curveData.push({
          freq: w,
          amplitude: calculateResonanceAmplitude(w, { m: params.mass, k: params.k, b: params.damping, F0: params.f0, wd: w })
        });
      }
      setData(curveData);
      return;
    }

    if (isPaused) return;
    const dt = 0.05;
    const interval = setInterval(() => {
      let accelFn;
      if (module === 'mass-spring' || module === 'energy') accelFn = massSpringAccel({ m: params.mass, k: params.k, b: params.damping });
      else if (module === 'pendulum') accelFn = pendulumAccel({ L: params.length, g: params.gravity, b: params.damping });
      else if (module === 'resonance') accelFn = forcedAccel({ m: params.mass, k: params.k, b: params.damping, F0: params.f0, wd: params.wd });
      else if (module === 'waves') {
        const driving = params.waveAmplitude * Math.sin(params.wd * stateRef.current.t + params.wavePhase);
        accelFn = () => (driving - params.damping * stateRef.current.v) / params.mass;
      } else return;

      stateRef.current = stepRK4(stateRef.current, dt, accelFn);
      
      setData(prev => {
        let newValue: any;
        if (type === 'energy') {
          const ke = 0.5 * params.mass * stateRef.current.v * stateRef.current.v;
          const pe = 0.5 * params.k * stateRef.current.x * stateRef.current.x;
          newValue = { time: stateRef.current.t, ke, pe, total: ke + pe };
        } else {
          let val = stateRef.current.x;
          if (type === 'velocity') val = stateRef.current.v;
          newValue = { time: stateRef.current.t, value: val };
        }
        const newData = [...prev, newValue];
        return newData.slice(-100);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused, type, module, params]);

  if (type === 'resonance-curve') {
    const naturalFreq = Math.sqrt(params.k / params.mass);
    const peakAmplitude = calculateResonanceAmplitude(naturalFreq, { m: params.mass, k: params.k, b: params.damping, F0: params.f0, wd: naturalFreq });

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
          <XAxis dataKey="freq" label={{ value: 'Frequency (rad/s)', position: 'insideBottom', offset: -5, fill: 'white', fontSize: 10 }} hide />
          <YAxis hide />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(125, 114, 181, 0.9)', border: 'none', borderRadius: '12px', fontSize: '10px', color: 'white' }}
            itemStyle={{ color: 'white' }}
          />
          <Area type="monotone" dataKey="amplitude" stroke="#c4b5fd" fill="#c4b5fd33" strokeWidth={2} isAnimationActive={false} />
          {/* Highlight current frequency */}
          <Area type="monotone" dataKey={(d) => Math.abs(d.freq - params.wd) < 0.1 ? d.amplitude : null} stroke="white" fill="white" isAnimationActive={false} />
          {/* Peak Indicator */}
          <Area type="monotone" dataKey={(d) => Math.abs(d.freq - naturalFreq) < 0.1 ? d.amplitude : null} stroke="#fbbf24" fill="#fbbf24" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="white" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="white" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
        <XAxis dataKey="time" hide />
        <YAxis domain={['auto', 'auto']} hide />
        <Tooltip 
          contentStyle={{ backgroundColor: 'rgba(125, 114, 181, 0.9)', border: 'none', borderRadius: '12px', fontSize: '10px', color: 'white' }}
          itemStyle={{ color: 'white' }}
          labelStyle={{ display: 'none' }}
        />
        {type === 'energy' ? (
          <>
            <Area type="monotone" dataKey="ke" stroke="#c4b5fd" fill="none" strokeWidth={2} isAnimationActive={false} />
            <Area type="monotone" dataKey="pe" stroke="#818cf8" fill="none" strokeWidth={2} isAnimationActive={false} />
            <Area type="monotone" dataKey="total" stroke="white" fill="none" strokeWidth={1} strokeDasharray="5 5" isAnimationActive={false} />
          </>
        ) : (
          <Area type="monotone" dataKey="value" stroke="white" strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${type})`} isAnimationActive={false} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EnergyDisplay({ module, isPaused, params, horizontal = false }: { module: string, isPaused: boolean, params: SimulationParams, horizontal?: boolean }) {
  const [energyData, setEnergyData] = useState<{ name: string, value: number, color: string }[]>([]);
  const stateRef = useRef<SimulationState>({ x: module === 'pendulum' ? params.initialAngle : 1.0, v: 0, t: 0 });

  useEffect(() => {
    const handleReset = () => {
      stateRef.current = { x: module === 'pendulum' ? params.initialAngle : 1.0, v: 0, t: 0 };
    };
    window.addEventListener('reset-sim', handleReset);
    handleReset();
    return () => window.removeEventListener('reset-sim', handleReset);
  }, [module, params.initialAngle]);

  useEffect(() => {
    if (isPaused) return;
    const dt = 0.05;
    const interval = setInterval(() => {
      let ke = 0, pe = 0;
      if (module === 'mass-spring' || module === 'energy' || module === 'resonance') {
        stateRef.current = stepRK4(stateRef.current, dt, massSpringAccel({ m: params.mass, k: params.k, b: params.damping }));
        ke = 0.5 * params.mass * stateRef.current.v * stateRef.current.v;
        pe = 0.5 * params.k * stateRef.current.x * stateRef.current.x;
      } else if (module === 'pendulum') {
        stateRef.current = stepRK4(stateRef.current, dt, pendulumAccel({ L: params.length, g: params.gravity, b: params.damping }));
        ke = 0.5 * params.mass * Math.pow(params.length * stateRef.current.v, 2);
        pe = params.mass * params.gravity * params.length * (1 - Math.cos(stateRef.current.x));
      }
      setEnergyData([
        { name: 'Kinetic Energy', value: ke, color: '#c4b5fd' },
        { name: 'Potential Energy', value: pe, color: '#9d7af2' },
        { name: 'Total Energy', value: ke + pe, color: '#ffffff' }
      ]);
    }, 50);
    return () => clearInterval(interval);
  }, [isPaused, module, params]);

  const maxEnergy = useMemo(() => {
    if (energyData.length === 0) return 25;
    return Math.max(...energyData.map(d => d.value), 10) * 1.2;
  }, [energyData]);

  return (
    <div className={`${horizontal ? 'grid grid-cols-1 md:grid-cols-3 gap-8' : 'space-y-4'} py-2`}>
      {energyData.map((item) => (
        <div key={item.name} className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{item.name}</span>
            <span className="text-sm font-mono font-bold text-white">
              {item.value.toFixed(3)} <span className="text-[10px] text-white/40">J</span>
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shadow-neu-inset">
            <motion.div 
              initial={false}
              animate={{ width: `${(item.value / maxEnergy) * 100}%` }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TheoryDisplay({ module }: { module: ModuleType }) {
  const currentModule = MODULES.find(m => m.id === module)!;
  return (
    <div className="space-y-4 py-2 h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 text-white/80">
        <Info size={14} className="text-cosmic-accent" />
        <h4 className="font-bold text-xs uppercase tracking-wider">Core Concepts</h4>
      </div>
      <p className="text-[11px] text-white/60 leading-relaxed">{currentModule.theory}</p>
      <div className="bg-black/20 p-3 rounded-xl font-mono text-[10px] text-center text-cosmic-accent shadow-neu-inset">
        {currentModule.formula}
      </div>
      <ul className="space-y-2">
        {currentModule.insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-[10px] text-white/40">
            <div className="w-1 h-1 rounded-full bg-cosmic-accent/50 mt-1.5" />
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}

const OscillationLogo = () => {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Background Glow */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-40 h-40 bg-cosmic-accent/20 rounded-full blur-3xl"
      />

      {/* Central Sphere */}
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-gray-800 to-black shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent)]" />
      </div>

      {/* Oscillating Ribbon (SVG) */}
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0" />
            <stop offset="50%" stopColor="#9d7af2" />
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        <motion.path
          d="M 20 100 Q 60 80 100 100 T 180 100"
          fill="none"
          stroke="url(#ribbonGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          filter="url(#glow)"
          animate={{
            d: [
              "M 20 100 Q 60 80 100 100 T 180 100",
              "M 20 100 Q 60 120 100 100 T 180 100",
              "M 20 100 Q 60 80 100 100 T 180 100"
            ],
            rotate: [0, 360]
          }}
          transition={{
            d: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 20, repeat: Infinity, ease: "linear" }
          }}
          style={{ originX: "100px", originY: "100px" }}
        />

        <motion.path
          d="M 20 100 Q 60 120 100 100 T 180 100"
          fill="none"
          stroke="url(#ribbonGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.5"
          animate={{
            d: [
              "M 20 100 Q 60 120 100 100 T 180 100",
              "M 20 100 Q 60 80 100 100 T 180 100",
              "M 20 100 Q 60 120 100 100 T 180 100"
            ],
            rotate: [360, 0]
          }}
          transition={{
            d: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 30, repeat: Infinity, ease: "linear" }
          }}
          style={{ originX: "100px", originY: "100px" }}
        />
      </svg>
    </div>
  );
};

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] bg-cosmic-bg flex flex-col items-center justify-center overflow-hidden"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="mb-12"
      >
        <OscillationLogo />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-5xl font-black tracking-[0.2em] text-white uppercase mb-2">
          Oscillation <span className="text-cosmic-accent">Lab</span>
        </h1>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "200px" }}
          transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
          onAnimationComplete={() => setTimeout(onComplete, 500)}
          className="h-1 bg-gradient-to-r from-transparent via-cosmic-accent to-transparent mx-auto"
        />
        <p className="mt-4 text-white/30 text-[10px] font-bold tracking-[0.5em] uppercase">
          Universal Physics Simulation
        </p>
      </motion.div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleType>('mass-spring');
  const [isPaused, setIsPaused] = useState(true);
  const [params, setParams] = useState<SimulationParams>({
    mass: 1.0, 
    k: 10.0, 
    damping: 0.1, 
    length: 1.0, 
    gravity: 9.8, 
    gravityPreset: 'earth',
    f0: 5.0, 
    wd: 3.16, 
    numOscillators: 20,
    initialAngle: 0.8,
    showSmallAngle: false,
    isDoublePendulum: false,
    waveType: 'transverse',
    waveAmplitude: 1.0,
    wavePhase: 0
  });
  const [showTheory, setShowTheory] = useState(false);
  const [activeTheoryTab, setActiveTheoryTab] = useState<'theory' | 'real-world'>('theory');
  const [activeRealWorldTab, setActiveRealWorldTab] = useState<string>('Atoms');
  const [showQuiz, setShowQuiz] = useState(false);
  const [showVectors, setShowVectors] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (soundEnabled && !isPaused) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
    } else {
      oscillatorRef.current?.stop();
      oscillatorRef.current = null;
    }
    return () => {
      oscillatorRef.current?.stop();
    };
  }, [soundEnabled, isPaused]);

  useEffect(() => {
    if (soundEnabled && !isPaused && oscillatorRef.current && gainNodeRef.current) {
      const interval = setInterval(() => {
        const baseFreq = params.wd * 50;
        oscillatorRef.current!.frequency.setTargetAtTime(baseFreq, audioCtxRef.current!.currentTime, 0.1);
        gainNodeRef.current!.gain.setTargetAtTime(0.05, audioCtxRef.current!.currentTime, 0.1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [soundEnabled, isPaused, params.wd]);

  const currentModule = MODULES.find(m => m.id === activeModule)!;

  const resetSimulation = () => {
    window.dispatchEvent(new CustomEvent('reset-sim'));
  };
  return (
    <div className="min-h-screen bg-cosmic-bg text-white font-sans selection:bg-cosmic-accent/30">
      <AnimatePresence>
        {isLoading && <SplashScreen onComplete={() => setIsLoading(false)} />}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12 custom-scrollbar">
      
      {/* Hero Section - Simulation Stage */}
      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Simulation Card */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              key={activeModule}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-[3rem] p-8 shadow-neu-flat relative min-h-[500px] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="space-y-1">
                  <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold tracking-widest uppercase mb-2">
                    Live Simulation
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-gradient uppercase">{currentModule.title}</h2>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setIsPaused(!isPaused)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-neu-button hover:scale-105 transition-all">
                    {isPaused ? <Play size={20} /> : <Pause size={20} />}
                  </button>
                  <button onClick={resetSimulation} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-neu-button hover:scale-105 transition-all">
                    <RotateCcw size={20} />
                  </button>
                  <button onClick={() => setShowTheory(!showTheory)} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-neu-button hover:scale-105 transition-all ${showTheory ? 'bg-white/20' : 'bg-white/10'}`}>
                    <BookOpen size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden">
                <div 
                  className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${showGrid ? 'opacity-10' : 'opacity-0'}`} 
                  style={{ 
                    backgroundImage: `
                      linear-gradient(to right, white 1px, transparent 1px),
                      linear-gradient(to bottom, white 1px, transparent 1px),
                      linear-gradient(to right, white 1px, transparent 1px),
                      linear-gradient(to bottom, white 1px, transparent 1px)
                    `,
                    backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px'
                  }} 
                />
                
                <SimulationModule type={activeModule} isPaused={isPaused} params={params} />

                <AnimatePresence>
                  {isPaused && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] z-20 cursor-pointer group"
                      onClick={() => setIsPaused(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-neu-flat group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300"
                      >
                        <div className="ml-2">
                          <Play size={48} fill="currentColor" className="text-cosmic-accent" />
                        </div>
                      </motion.div>
                      <div className="absolute bottom-12 text-[10px] font-bold tracking-[0.4em] text-white/40 uppercase animate-pulse">
                        Click to Start Simulation
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

          </div>

          {/* Controls Panel */}
          <div className="space-y-8">
            <div className="glass-card rounded-[3rem] p-8 shadow-neu-flat space-y-8">
              <div className="flex items-center gap-2 text-white/50 mb-2">
                <Settings size={14} />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">Parameters</h3>
              </div>
              
              <div className="space-y-6">
                {(activeModule === 'mass-spring' || activeModule === 'resonance' || activeModule === 'energy') && (
                  <>
                    <ControlSlider 
                      label="Mass (m)" min={0.5} max={5} step={0.1} unit="kg" value={params.mass} 
                      onChange={(v) => setParams({...params, mass: v})} 
                      description="Adjust the mass of the oscillating object. Higher mass increases inertia and slows down the oscillation."
                    />
                    <ControlSlider 
                      label="Spring Constant (k)" min={1} max={50} step={1} unit="N/m" value={params.k} 
                      onChange={(v) => setParams({...params, k: v})} 
                      description="Adjust the stiffness of the spring. A higher constant means a stiffer spring and faster oscillations."
                    />
                  </>
                )}
                {activeModule === 'pendulum' && (
                  <>
                    <ControlSlider 
                      label="Length (L)" min={0.5} max={3} step={0.1} unit="m" value={params.length} 
                      onChange={(v) => setParams({...params, length: v})} 
                      description="Adjust the length of the pendulum string. Longer pendulums have longer time periods."
                    />
                    <ControlSlider 
                      label="Initial Angle (θ)" min={-1.5} max={1.5} step={0.1} unit="rad" value={params.initialAngle} 
                      onChange={(v) => setParams({...params, initialAngle: v})} 
                      description="Set the starting angle for the pendulum. Larger angles show more nonlinear behavior."
                    />
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Gravity Preset</label>
                      <div className="flex gap-2">
                        {(['earth', 'moon', 'mars'] as const).map(p => (
                          <button 
                            key={p}
                            title={`Set gravity to ${p === 'earth' ? '9.8' : p === 'moon' ? '1.6' : '3.7'} m/s²`}
                            onClick={() => {
                              const gMap = { earth: 9.8, moon: 1.6, mars: 3.7 };
                              setParams({...params, gravityPreset: p, gravity: gMap[p]});
                            }}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all shadow-neu-button ${params.gravityPreset === p ? 'bg-white text-cosmic-bg' : 'bg-white/5 text-white/40'}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {activeModule === 'resonance' && (
                  <>
                    <ControlSlider 
                      label="Driving Force (F₀)" min={0} max={20} step={0.5} unit="N" value={params.f0} 
                      onChange={(v) => setParams({...params, f0: v})} 
                      description="The amplitude of the external periodic force applied to the system."
                    />
                    <ControlSlider 
                      label="Driving Freq (ω_d)" min={0.1} max={10} step={0.1} unit="rad/s" value={params.wd} 
                      onChange={(v) => setParams({...params, wd: v})} 
                      description="The frequency of the external force. Resonance occurs when this matches the natural frequency."
                    />
                  </>
                )}
                {activeModule === 'waves' && (
                  <>
                    <ControlSlider 
                      label="Oscillators" min={5} max={50} step={1} unit="" value={params.numOscillators} 
                      onChange={(v) => setParams({...params, numOscillators: v})} 
                      description="The number of individual points used to simulate wave propagation."
                    />
                    <ControlSlider 
                      label="Wave Amplitude" min={0.1} max={2} step={0.1} unit="m" value={params.waveAmplitude} 
                      onChange={(v) => setParams({...params, waveAmplitude: v})} 
                      description="The maximum displacement of the wave from its equilibrium position."
                    />
                    <ControlSlider 
                      label="Wave Phase" min={0} max={Math.PI * 2} step={0.1} unit="rad" value={params.wavePhase} 
                      onChange={(v) => setParams({...params, wavePhase: v})} 
                      description="The starting point of the wave cycle."
                    />
                  </>
                )}
                <ControlSlider 
                  label="Damping (b)" min={0} max={2} step={0.01} unit="kg/s" value={params.damping} 
                  onChange={(v) => setParams({...params, damping: v})} 
                  description="The resistance to motion (like air resistance or friction). Higher damping causes oscillations to die out faster."
                />
              </div>
            </div>

            {/* Visual Toggles */}
            <div className="glass-card rounded-[2.5rem] p-8 shadow-neu-flat space-y-4">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Visual Options</h3>
              
              {activeModule === 'pendulum' && (
                <>
                  <div 
                    onClick={() => setParams({...params, showSmallAngle: !params.showSmallAngle})} 
                    className="flex items-center justify-between group cursor-pointer"
                    title="Compare the real pendulum motion with the simplified linear approximation (sin θ ≈ θ)."
                  >
                    <span className="text-xs text-white/60">Small Angle Approx</span>
                    <div className={`w-10 h-5 rounded-full shadow-neu-inset relative transition-colors ${params.showSmallAngle ? 'bg-cosmic-accent/30' : 'bg-white/10'}`}>
                      <motion.div animate={{ x: params.showSmallAngle ? 20 : 0 }} className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                  <div 
                    onClick={() => setParams({...params, isDoublePendulum: !params.isDoublePendulum})} 
                    className="flex items-center justify-between group cursor-pointer"
                    title="Switch to a chaotic double pendulum system with two connected masses."
                  >
                    <span className="text-xs text-white/60">Double Pendulum</span>
                    <div className={`w-10 h-5 rounded-full shadow-neu-inset relative transition-colors ${params.isDoublePendulum ? 'bg-cosmic-accent/30' : 'bg-white/10'}`}>
                      <motion.div animate={{ x: params.isDoublePendulum ? 20 : 0 }} className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                </>
              )}

              {activeModule === 'waves' && (
                <div 
                  onClick={() => setParams({...params, waveType: params.waveType === 'transverse' ? 'longitudinal' : 'transverse'})} 
                  className="flex items-center justify-between group cursor-pointer"
                  title="Switch between transverse waves (up/down) and longitudinal waves (left/right compression)."
                >
                  <span className="text-xs text-white/60">Longitudinal Wave</span>
                  <div className={`w-10 h-5 rounded-full shadow-neu-inset relative transition-colors ${params.waveType === 'longitudinal' ? 'bg-cosmic-accent/30' : 'bg-white/10'}`}>
                    <motion.div animate={{ x: params.waveType === 'longitudinal' ? 20 : 0 }} className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              )}

              <div 
                onClick={() => setShowVectors(!showVectors)}
                className="flex items-center justify-between group cursor-pointer"
                title="Visualize force and velocity vectors acting on the system."
              >
                <span className="text-xs text-white/60">Show Vectors</span>
                <div className={`w-10 h-5 rounded-full shadow-neu-inset relative transition-colors ${showVectors ? 'bg-cosmic-accent/30' : 'bg-white/10'}`}>
                  <motion.div 
                    animate={{ x: showVectors ? 20 : 0 }}
                    className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" 
                  />
                </div>
              </div>
              <div 
                onClick={() => setShowGrid(!showGrid)}
                className="flex items-center justify-between group cursor-pointer"
                title="Toggle the background reference grid for precise measurement."
              >
                <span className="text-xs text-white/60">Show Grid</span>
                <div className={`w-10 h-5 rounded-full shadow-neu-inset relative transition-colors ${showGrid ? 'bg-cosmic-accent/30' : 'bg-white/10'}`}>
                  <motion.div 
                    animate={{ x: showGrid ? 20 : 0 }}
                    className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" 
                  />
                </div>
              </div>
              <div 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center justify-between group cursor-pointer"
                title="Generate an audio tone that changes pitch based on the oscillation frequency."
              >
                <span className="text-xs text-white/60">Enable Sound</span>
                <div className={`w-10 h-5 rounded-full shadow-neu-inset relative transition-colors ${soundEnabled ? 'bg-cosmic-accent/30' : 'bg-white/10'}`}>
                  <motion.div 
                    animate={{ x: soundEnabled ? 20 : 0 }}
                    className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Graphs & Theory Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="glass-card rounded-[2.5rem] p-6 shadow-neu-flat h-64">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {activeModule === 'pendulum' ? 'Angle (θ)' : activeModule === 'resonance' ? 'Resonance Curve' : 'Displacement (x)'}
            </h3>
            <Activity size={14} className="text-white/30" />
          </div>
          <div className="h-40">
            <RealTimeGraph 
              type={activeModule === 'resonance' ? 'resonance-curve' : 'displacement'} 
              module={activeModule} 
              isPaused={isPaused} 
              params={params} 
            />
          </div>
        </div>
        <div className="glass-card rounded-[2.5rem] p-6 shadow-neu-flat h-64">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {activeModule === 'energy' ? 'Energy vs Time' : 'Velocity (v)'}
            </h3>
            <Battery size={14} className="text-white/30" />
          </div>
          <div className="h-40 overflow-y-auto custom-scrollbar">
            {activeModule === 'energy' ? (
              <RealTimeGraph type="energy" module={activeModule} isPaused={isPaused} params={params} />
            ) : (
              <RealTimeGraph type="velocity" module={activeModule} isPaused={isPaused} params={params} />
            )}
          </div>
        </div>
        <div className="glass-card rounded-[2.5rem] p-6 shadow-neu-flat h-64">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Theory & Insights</h3>
            <BookOpen size={14} className="text-white/30" />
          </div>
          <div className="h-40">
            <TheoryDisplay module={activeModule} />
          </div>
        </div>
      </div>

      {/* Floating Navigation */}
      <div className="flex justify-center">
        <div className="glass-card px-4 py-3 rounded-3xl shadow-neu-flat flex gap-6">
          <NavButton icon={Home} active />
          <NavButton icon={Grid} />
          <NavButton icon={Settings} />
          <NavButton icon={User} />
        </div>
      </div>

      {/* Module Selector Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {MODULES.map((module) => (
          <motion.div 
            key={module.id}
            whileHover={{ scale: 1.03, y: -5 }}
            onClick={() => {
              setActiveModule(module.id);
              resetSimulation();
            }}
            className={`glass-card rounded-[2.5rem] p-8 shadow-neu-flat relative overflow-hidden cursor-pointer transition-all ${activeModule === module.id ? 'ring-2 ring-white/30' : ''}`}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
               {module.id === 'mass-spring' && <Activity size={64} />}
               {module.id === 'pendulum' && <Timer size={64} />}
               {module.id === 'resonance' && <Zap size={64} />}
               {module.id === 'energy' && <Battery size={64} />}
               {module.id === 'waves' && <Waves size={64} />}
            </div>
            <div className="space-y-4 relative z-10">
              <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[9px] font-bold tracking-widest uppercase">{module.id}</div>
              <h3 className="text-xl font-bold">{module.title}</h3>
              <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">
                {module.description}
              </p>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-neu-button ${activeModule === module.id ? 'bg-white text-cosmic-bg' : 'bg-white/10'}`}>
                <ArrowRight size={18} />
              </div>
            </div>
          </motion.div>
        ))}
        
        {/* Quiz Mode Card */}
        <motion.div 
          whileHover={{ scale: 1.03, y: -5 }}
          className="glass-card rounded-[2.5rem] p-8 shadow-neu-flat relative overflow-hidden cursor-pointer bg-gradient-to-br from-white/10 to-transparent"
        >
          <div className="space-y-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shadow-neu-button mb-2">
              <Trophy size={24} className="text-white" />
            </div>
            <h3 className="text-xl font-bold">Quiz Mode</h3>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Test your understanding of oscillation physics with our interactive assessment.
            </p>
            <NeumorphicButton 
              onClick={() => setShowQuiz(true)}
              className="bg-white/10 text-[10px] w-full"
            >
              START QUIZ
            </NeumorphicButton>
          </div>
        </motion.div>
      </div>

      {/* Quiz Overlay */}
      <AnimatePresence>
        {showQuiz && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-cosmic-bg/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card max-w-lg w-full rounded-[3rem] p-12 shadow-neu-flat relative"
            >
              <button 
                onClick={() => setShowQuiz(false)}
                className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shadow-neu-button"
              >
                <Plus size={20} className="rotate-45" />
              </button>
              
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center shadow-neu-button">
                    <Trophy size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black">Physics Quiz</h2>
                    <p className="text-sm text-white/50">Module: {currentModule.title}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-white/5 rounded-3xl shadow-neu-inset">
                    <p className="text-lg font-medium">What happens to the period of a mass-spring system if the mass is quadrupled?</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {['It doubles', 'It halves', 'It stays the same', 'It quadruples'].map((opt, i) => (
                      <button key={i} className="w-full py-4 px-6 rounded-2xl bg-white/5 shadow-neu-button hover:bg-white/10 transition-all text-left text-sm font-medium">
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll Indicator */}
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase">Scroll</p>
        <motion.div 
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-10 h-10 rounded-2xl bg-white/5 shadow-neu-button flex items-center justify-center"
        >
          <ChevronDown size={20} className="text-white/50" />
        </motion.div>
      </div>

      {/* Real World Applications Section */}
      <div className="space-y-6">
        <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Real World Applications</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Atoms', 'Bridges', 'Clocks', 'Strings'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveRealWorldTab(tab)}
              className={`w-full py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-neu-button ${activeRealWorldTab === tab ? 'bg-white text-cosmic-bg' : 'bg-white/5 text-white/40'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={activeRealWorldTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-[2.5rem] p-8 shadow-neu-flat grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-neu-button">
                  <Globe size={20} className="text-cosmic-accent" />
                </div>
                <h4 className="text-2xl font-black uppercase tracking-tight">{activeRealWorldTab}</h4>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                {activeRealWorldTab === 'Atoms' && MODULES.find(m => m.id === 'mass-spring')?.realWorld?.content}
                {activeRealWorldTab === 'Bridges' && MODULES.find(m => m.id === 'resonance')?.realWorld?.content}
                {activeRealWorldTab === 'Clocks' && MODULES.find(m => m.id === 'pendulum')?.realWorld?.content}
                {activeRealWorldTab === 'Strings' && MODULES.find(m => m.id === 'waves')?.realWorld?.content}
              </p>
              <NeumorphicButton 
                onClick={() => {
                  const idMap: Record<string, ModuleType> = { 'Atoms': 'mass-spring', 'Bridges': 'resonance', 'Clocks': 'pendulum', 'Strings': 'waves' };
                  setActiveModule(idMap[activeRealWorldTab]);
                  resetSimulation();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-white/10 text-[10px]"
              >
                VIEW SIMULATION
              </NeumorphicButton>
            </div>
            <div className="relative h-64 rounded-3xl overflow-hidden shadow-neu-inset">
              <img 
                src={`https://picsum.photos/seed/${activeRealWorldTab.toLowerCase()}/800/600`} 
                alt={activeRealWorldTab} 
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-cosmic-bg/80 to-transparent" />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>


      {/* Footer */}
      <footer className="text-center py-12">
        <p className="text-[10px] font-bold tracking-[0.4em] text-white/20 uppercase">
          Created by Universal Lab Team
        </p>
      </footer>
    </div>
  </div>
);
}
