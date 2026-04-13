export type ModuleType = 'mass-spring' | 'pendulum' | 'resonance' | 'energy' | 'waves';

export interface ModuleInfo {
  id: ModuleType;
  title: string;
  icon: string;
  description: string;
  theory: string;
  formula: string;
  insights: string[];
  realWorld?: {
    title: string;
    content: string;
  };
}

export const MODULES: ModuleInfo[] = [
  {
    id: 'mass-spring',
    title: 'Mass-Spring System',
    icon: 'Activity',
    description: 'Explore Simple Harmonic Motion with a mass attached to a spring.',
    theory: 'A mass-spring system is a classic example of SHM. When the mass is displaced from equilibrium, the spring exerts a restoring force proportional to the displacement (Hooke\'s Law).',
    formula: 'm \frac{d^2x}{dt^2} + b \frac{dx}{dt} + kx = 0',
    insights: [
      'Period depends on mass and spring constant.',
      'Damping reduces amplitude over time.',
      'Energy oscillates between kinetic and potential.'
    ],
    realWorld: {
      title: 'Atoms',
      content: 'In solid-state physics, the bonds between atoms in a crystal lattice act like tiny springs. Thermal energy causes these atoms to oscillate around their equilibrium positions, a concept fundamental to understanding heat capacity and sound propagation in solids.'
    }
  },
  {
    id: 'pendulum',
    title: 'Pendulum Simulator',
    icon: 'Timer',
    description: 'Compare small-angle approximations with real pendulum motion.',
    theory: 'A simple pendulum consists of a mass hanging from a pivot. For small angles, it approximates SHM, but for large angles, the period depends on the initial displacement.',
    formula: 'T \approx 2\pi \sqrt{\frac{L}{g}}',
    insights: [
      'Period is independent of mass.',
      'Period increases slightly with larger initial angles.',
      'Gravity is the restoring force.'
    ],
    realWorld: {
      title: 'Clocks',
      content: 'Before digital electronics, pendulum clocks were the standard for timekeeping. Christian Huygens discovered that the period of a pendulum is nearly constant for small swings, allowing it to regulate the gears of a clock with high precision.'
    }
  },
  {
    id: 'resonance',
    title: 'Resonance & Forced',
    icon: 'Zap',
    description: 'Observe how external driving forces affect an oscillator.',
    theory: 'When an external periodic force is applied to an oscillator, the amplitude reaches a maximum when the driving frequency matches the natural frequency of the system.',
    formula: 'F = F_0 \sin(\omega t)',
    insights: [
      'Resonance occurs at \omega_d = \omega_0.',
      'Phase shift changes rapidly near resonance.',
      'Damping limits the maximum amplitude at resonance.'
    ],
    realWorld: {
      title: 'Bridges',
      content: 'Structural resonance can be catastrophic. The Tacoma Narrows Bridge collapse is a famous example where wind-induced oscillations matched the bridge\'s natural frequency, leading to massive amplitudes that eventually tore the structure apart.'
    }
  },
  {
    id: 'energy',
    title: 'Energy Visualization',
    icon: 'Battery',
    description: 'Real-time breakdown of kinetic and potential energy.',
    theory: 'In an ideal SHM system, total energy is conserved. It continuously transforms between kinetic energy (maximum at equilibrium) and potential energy (maximum at amplitude).',
    formula: 'E_{total} = \frac{1}{2}mv^2 + \frac{1}{2}kx^2',
    insights: [
      'Total energy is constant (without damping).',
      'KE is max when displacement is zero.',
      'PE is max when velocity is zero.'
    ]
  },
  {
    id: 'waves',
    title: 'Wave Formation',
    icon: 'Waves',
    description: 'See how a chain of oscillators creates a traveling wave.',
    theory: 'Waves are formed when oscillations propagate through a medium. Each point in the medium oscillates around its equilibrium position, passing energy to its neighbor.',
    formula: 'y(x,t) = A \sin(kx - \omega t)',
    insights: [
      'Frequency is determined by the source.',
      'Wavelength depends on frequency and wave speed.',
      'Energy travels, but matter only oscillates.'
    ],
    realWorld: {
      title: 'String',
      content: 'Musical instruments like guitars and violins rely on standing waves in strings. When a string is plucked, it oscillates at specific frequencies determined by its tension, mass, and length, creating the rich harmonics we hear as music.'
    }
  }
];
