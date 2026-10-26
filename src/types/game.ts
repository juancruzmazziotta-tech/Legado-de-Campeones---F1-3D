export type CarTeamId = 'ferrari_2004' | 'senna_classic' | 'f1_2022' | 'f1_2026';

export interface CarSpecs {
  id: CarTeamId;
  name: string;
  driver: string;
  team: string;
  era: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  topSpeed: number; // km/h
  acceleration: number; // 0-100 time in seconds
  handling: number; // 1-10
  powerUnit: string;
  description: string;
  glbFile: string;
  customModelUrl?: string;
}

export type CircuitId = 'silverstone' | 'imola' | 'spa';

export interface CircuitInfo {
  id: CircuitId;
  name: string;
  country: string;
  length: string;
  corners: number;
  drsZones: number;
  description: string;
  lapRecord: string;
  backgroundColor: string;
  glbFile: string;
  customModelUrl?: string;
}

export type ControlMode = 'gyro' | 'touch';
export type CameraMode = 'cockpit' | 'chase' | 'cinematic';
export type DrivingMode = 'practice' | 'time_attack';

export interface GameTelemetry {
  speedKmh: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steerAngle: number; // -1 to 1
  lapTime: number;
  bestLapTime: number | null;
  sector: 1 | 2 | 3;
  lapCount: number;
  isOffTrack: boolean;
  drsAvailable: boolean;
  drsActive: boolean;
}

export interface SensorStatus {
  gyroAllowed: boolean;
  micAllowed: boolean;
  cameraAllowed: boolean;
  gyroAvailable: boolean;
}

export interface OrientationData {
  alpha: number; // 0-360 (yaw)
  beta: number;  // -180 to 180 (pitch)
  gamma: number; // -90 to 90 (roll)
}

export interface AudioMetrics {
  volume: number; // 0.0 - 1.0
  bassLevel: number; // 0.0 - 1.0
}
