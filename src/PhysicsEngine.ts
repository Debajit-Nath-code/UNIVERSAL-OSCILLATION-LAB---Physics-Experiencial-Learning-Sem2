/**
 * Physics Engine for Universal Oscillation Lab
 * Implements numerical integration for various oscillation systems.
 */

export interface SimulationState {
  x: number;  // displacement or angle
  v: number;  // velocity or angular velocity
  t: number;  // time
}

export interface DoublePendulumState {
  theta1: number;
  omega1: number;
  theta2: number;
  omega2: number;
  t: number;
}

export interface MassSpringParams {
  m: number;  // mass
  k: number;  // spring constant
  b: number;  // damping coefficient
}

export interface PendulumParams {
  L: number;  // length
  g: number;  // gravity
  b: number;  // damping
}

export interface DoublePendulumParams {
  L1: number;
  L2: number;
  m1: number;
  m2: number;
  g: number;
}

export interface ForcedParams extends MassSpringParams {
  F0: number; // driving force amplitude
  wd: number; // driving frequency
}

/**
 * Runge-Kutta 4th Order Integration
 */
export function stepRK4(
  state: SimulationState,
  dt: number,
  accelerationFn: (s: SimulationState) => number
): SimulationState {
  const k1_v = accelerationFn(state);
  const k1_x = state.v;

  const k2_v = accelerationFn({
    x: state.x + k1_x * dt / 2,
    v: state.v + k1_v * dt / 2,
    t: state.t + dt / 2
  });
  const k2_x = state.v + k1_v * dt / 2;

  const k3_v = accelerationFn({
    x: state.x + k2_x * dt / 2,
    v: state.v + k2_v * dt / 2,
    t: state.t + dt / 2
  });
  const k3_x = state.v + k2_v * dt / 2;

  const k4_v = accelerationFn({
    x: state.x + k3_x * dt,
    v: state.v + k3_v * dt,
    t: state.t + dt
  });
  const k4_x = state.v + k3_v * dt;

  return {
    x: state.x + (dt / 6) * (k1_x + 2 * k2_x + 2 * k3_x + k4_x),
    v: state.v + (dt / 6) * (k1_v + 2 * k2_v + 2 * k3_v + k4_v),
    t: state.t + dt
  };
}

/**
 * Mass-Spring Acceleration: a = (-kx - bv) / m
 */
export const massSpringAccel = (params: MassSpringParams) => (state: SimulationState) => {
  return (-params.k * state.x - params.b * state.v) / params.m;
};

/**
 * Pendulum Acceleration: alpha = (-g/L * sin(theta) - b*omega)
 */
export const pendulumAccel = (params: PendulumParams) => (state: SimulationState) => {
  return (-params.g / params.L) * Math.sin(state.x) - params.b * state.v;
};

/**
 * Pendulum Small Angle Acceleration: alpha = (-g/L * theta - b*omega)
 */
export const pendulumSmallAngleAccel = (params: PendulumParams) => (state: SimulationState) => {
  return (-params.g / params.L) * state.x - params.b * state.v;
};

/**
 * Double Pendulum Derivatives
 */
export function doublePendulumDerivatives(state: DoublePendulumState, params: DoublePendulumParams) {
  const { theta1, omega1, theta2, omega2 } = state;
  const { L1, L2, m1, m2, g } = params;

  const num1 = -g * (2 * m1 + m2) * Math.sin(theta1);
  const num2 = -m2 * g * Math.sin(theta1 - 2 * theta2);
  const num3 = -2 * Math.sin(theta1 - theta2) * m2;
  const num4 = omega2 * omega2 * L2 + omega1 * omega1 * L1 * Math.cos(theta1 - theta2);
  const den = L1 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const d_omega1 = (num1 + num2 + num3 * num4) / den;

  const num5 = 2 * Math.sin(theta1 - theta2);
  const num6 = omega1 * omega1 * L1 * (m1 + m2);
  const num7 = g * (m1 + m2) * Math.cos(theta1);
  const num8 = omega2 * omega2 * L2 * m2 * Math.cos(theta1 - theta2);
  const den2 = L2 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const d_omega2 = (num5 * (num6 + num7 + num8)) / den2;

  return { d_theta1: omega1, d_omega1, d_theta2: omega2, d_omega2 };
}

export function stepRK4Double(state: DoublePendulumState, dt: number, params: DoublePendulumParams): DoublePendulumState {
  const k1 = doublePendulumDerivatives(state, params);
  
  const s2 = {
    theta1: state.theta1 + k1.d_theta1 * dt / 2,
    omega1: state.omega1 + k1.d_omega1 * dt / 2,
    theta2: state.theta2 + k1.d_theta2 * dt / 2,
    omega2: state.omega2 + k1.d_omega2 * dt / 2,
    t: state.t + dt / 2
  };
  const k2 = doublePendulumDerivatives(s2, params);

  const s3 = {
    theta1: state.theta1 + k2.d_theta1 * dt / 2,
    omega1: state.omega1 + k2.d_omega1 * dt / 2,
    theta2: state.theta2 + k2.d_theta2 * dt / 2,
    omega2: state.omega2 + k2.d_omega2 * dt / 2,
    t: state.t + dt / 2
  };
  const k3 = doublePendulumDerivatives(s3, params);

  const s4 = {
    theta1: state.theta1 + k3.d_theta1 * dt,
    omega1: state.omega1 + k3.d_omega1 * dt,
    theta2: state.theta2 + k3.d_theta2 * dt,
    omega2: state.omega2 + k3.d_omega2 * dt,
    t: state.t + dt
  };
  const k4 = doublePendulumDerivatives(s4, params);

  return {
    theta1: state.theta1 + (dt / 6) * (k1.d_theta1 + 2 * k2.d_theta1 + 2 * k3.d_theta1 + k4.d_theta1),
    omega1: state.omega1 + (dt / 6) * (k1.d_omega1 + 2 * k2.d_omega1 + 2 * k3.d_omega1 + k4.d_omega1),
    theta2: state.theta2 + (dt / 6) * (k1.d_theta2 + 2 * k2.d_theta2 + 2 * k3.d_theta2 + k4.d_theta2),
    omega2: state.omega2 + (dt / 6) * (k1.d_omega2 + 2 * k2.d_omega2 + 2 * k3.d_omega2 + k4.d_omega2),
    t: state.t + dt
  };
}

/**
 * Forced Oscillator Acceleration: a = (F0*sin(wd*t) - kx - bv) / m
 */
export const forcedAccel = (params: ForcedParams) => (state: SimulationState) => {
  const drivingForce = params.F0 * Math.sin(params.wd * state.t);
  return (drivingForce - params.k * state.x - params.b * state.v) / params.m;
};

/**
 * Calculate steady-state amplitude for forced oscillation
 */
export function calculateResonanceAmplitude(w: number, params: ForcedParams): number {
  const { m, k, b, F0 } = params;
  const naturalFreq = Math.sqrt(k / m);
  const den = Math.sqrt(Math.pow(k - m * w * w, 2) + Math.pow(b * w, 2));
  return F0 / den;
}
