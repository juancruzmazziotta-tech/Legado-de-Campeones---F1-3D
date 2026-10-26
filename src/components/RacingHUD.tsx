import React, { useState, useEffect, useRef } from 'react';
import {
  GameTelemetry,
  CameraMode,
  ControlMode,
  DrivingMode,
  CarSpecs,
  CircuitInfo,
  AudioMetrics,
} from '../types/game';
import {
  Volume2,
  VolumeX,
  Camera,
  Compass,
  RotateCcw,
  LogOut,
  QrCode,
  Mic,
  ChevronDown,
  ChevronUp,
  Eye,
  Tv,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { audioManager, triggerHaptic } from '../audio/engineSound';

interface RacingHUDProps {
  car: CarSpecs;
  circuit: CircuitInfo;
  telemetry: GameTelemetry;
  cameraMode: CameraMode;
  controlMode: ControlMode;
  drivingMode: DrivingMode;
  audioMetrics: AudioMetrics;
  isMicActive: boolean;
  isCameraBgActive: boolean;
  onSetCameraMode: (mode: CameraMode) => void;
  onToggleDRS: () => void;
  onRestartLap: () => void;
  onRecoverToTrack?: () => void;
  onExit: () => void;
  onOpenQR: () => void;
  onToggleMic: () => void;
  onToggleCameraBg: () => void;
  // Tactile Inputs
  onSteerChange: (val: number) => void;
  onThrottleChange: (val: number) => void;
  onBrakeChange: (val: number) => void;
}

export const RacingHUD: React.FC<RacingHUDProps> = ({
  car,
  circuit,
  telemetry,
  cameraMode,
  controlMode,
  drivingMode,
  audioMetrics,
  isMicActive,
  onSetCameraMode,
  onToggleDRS,
  onRestartLap,
  onRecoverToTrack,
  onExit,
  onOpenQR,
  onSteerChange,
  onThrottleChange,
  onBrakeChange,
}) => {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);
  const [steeringTouchAngle, setSteeringTouchAngle] = useState<number>(0);

  // Touch Steering Wheel Ref
  const wheelRef = useRef<HTMLDivElement>(null);
  const isDraggingWheel = useRef<boolean>(false);
  const wheelCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Format Lap Time MM:SS.mmm
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Sound toggle
  const handleToggleSound = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
    triggerHaptic(15);
  };

  // Shortcut key for collapsing HUD
  useEffect(() => {
    const handleHUDKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setHudCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleHUDKey);
    return () => window.removeEventListener('keydown', handleHUDKey);
  }, []);

  // Touch steering wheel drag handlers
  const handleWheelStart = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    wheelCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    isDraggingWheel.current = true;
    updateWheelAngle(clientX, clientY);
  };

  const updateWheelAngle = (clientX: number, clientY: number) => {
    if (!isDraggingWheel.current) return;
    const dx = clientX - wheelCenterRef.current.x;
    const dy = clientY - wheelCenterRef.current.y;
    // Calculate rotation angle in degrees (-90 to +90)
    let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
    angleDeg = Math.max(-90, Math.min(90, angleDeg));
    setSteeringTouchAngle(angleDeg);
    const normalizedSteer = angleDeg / 90;
    onSteerChange(normalizedSteer);
  };

  const handleWheelEnd = () => {
    isDraggingWheel.current = false;
    setSteeringTouchAngle(0);
    onSteerChange(0);
  };

  // F1 RPM Shift LEDs calculations (15 LEDs: 5 green, 5 red, 5 purple)
  const maxRpm = 15000;
  const rpmRatio = Math.max(0, Math.min(1, telemetry.rpm / maxRpm));
  const activeLedsCount = Math.floor(rpmRatio * 15);
  const isRedlineFlashing = telemetry.rpm > 13800;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none z-20">
      {/* ============================================================ */}
      {/* TOP BAR: CIRCUIT INFO ON LEFT, COMPACT ACTIONS ON RIGHT */}
      {/* ============================================================ */}
      <header className="w-full flex items-start justify-between pointer-events-auto">
        {/* Top Left: Compact Circuit & Sector pill */}
        <div className="flex items-center gap-1.5 bg-black/75 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: car.primaryColor }}
          />
          <span className="font-racing font-bold text-xs text-white uppercase tracking-wider">
            {circuit.name.split(' (')[0]}
          </span>
          <span className="text-[10px] text-white/50 border-l border-white/20 pl-1.5 font-racing">
            S{telemetry.sector}
          </span>
          {controlMode === 'gyro' && (
            <span className="text-[9px] text-[#FF1801] font-racing font-bold pl-1 flex items-center gap-0.5">
              <Compass className="w-3 h-3" /> GIRO
            </span>
          )}
        </div>

        {/* Top Right: Compact Action Buttons (Reiniciar, Pista, Cámara, Sonido, Salir) */}
        <div className="flex items-center gap-1 bg-black/75 border border-white/10 p-1 rounded-full backdrop-blur-md shadow-lg">
          {/* Recover / Reincorporar Button */}
          {onRecoverToTrack && (
            <button
              onClick={() => {
                triggerHaptic(20);
                onRecoverToTrack();
              }}
              title="Reincorporar a pista (R)"
              className="px-2.5 py-1 rounded-full text-[11px] font-racing font-bold text-amber-400 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Pista (R)</span>
            </button>
          )}

          {/* Reiniciar Vuelta */}
          <button
            onClick={() => {
              triggerHaptic(20);
              onRestartLap();
            }}
            title="Reiniciar Vuelta"
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-racing text-white/70 hover:text-white hover:bg-white/10 transition flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#FFD700]" />
            <span className="hidden md:inline">Reiniciar</span>
          </button>

          {/* Camera View Switcher */}
          <div className="flex items-center bg-white/5 rounded-full p-0.5">
            <button
              onClick={() => {
                triggerHaptic(15);
                onSetCameraMode('cockpit');
              }}
              title="Vista Piloto Cockpit"
              className={`p-1.5 sm:px-2 sm:py-1 rounded-full text-xs font-racing transition cursor-pointer ${
                cameraMode === 'cockpit' ? 'bg-[#FF1801] text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                triggerHaptic(15);
                onSetCameraMode('chase');
              }}
              title="Vista Trasera"
              className={`p-1.5 sm:px-2 sm:py-1 rounded-full text-xs font-racing transition cursor-pointer ${
                cameraMode === 'chase' ? 'bg-[#FF1801] text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                triggerHaptic(15);
                onSetCameraMode('cinematic');
              }}
              title="Cámara TV"
              className={`p-1.5 sm:px-2 sm:py-1 rounded-full text-xs font-racing transition cursor-pointer ${
                cameraMode === 'cinematic' ? 'bg-[#FF1801] text-white font-bold' : 'text-white/60 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#FFD700]" />}
          </button>

          {/* Help */}
          <button
            onClick={() => {
              triggerHaptic(15);
              setShowKeyboardHelp((prev) => !prev);
            }}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="Ayuda de controles"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          </button>

          {/* Exit / Salir */}
          <button
            onClick={() => {
              triggerHaptic(20);
              onExit();
            }}
            className="p-1.5 rounded-full text-white/70 hover:text-red-400 hover:bg-white/10 transition cursor-pointer"
            title="Volver al menú"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* OFF-TRACK ALERT (Centered, unobtrusive banner) */}
      {/* ============================================================ */}
      {telemetry.isOffTrack && (
        <div className="flex flex-col items-center justify-center pointer-events-none -mt-4">
          <div className="px-3.5 py-1 rounded-full bg-red-600/90 text-white font-racing font-bold text-xs uppercase tracking-wider shadow-lg border border-white/20 animate-bounce pointer-events-auto">
            ⚠️ FUERA DE PISTA (LÍMITE 95 KM/H)
          </div>
        </div>
      )}

      {/* Keyboard Controls Modal Help */}
      {showKeyboardHelp && (
        <div className="absolute top-16 right-4 z-40 bg-black/90 border border-white/20 rounded-xl p-3.5 text-xs text-white max-w-xs shadow-2xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="font-racing font-bold text-[#FFD700] uppercase">Controles de PC / Teclado</span>
            <button
              onClick={() => setShowKeyboardHelp(false)}
              className="text-white/40 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>
          <ul className="space-y-1 font-mono text-[11px] text-white/80">
            <li><strong className="text-white">W / Flecha Arriba:</strong> Acelerar</li>
            <li><strong className="text-white">S / Flecha Abajo:</strong> Frenar / Marcha atrás</li>
            <li><strong className="text-white">A / Flecha Izquierda:</strong> Doblar a la izquierda</li>
            <li><strong className="text-white">D / Flecha Derecha:</strong> Doblar a la derecha</li>
            <li><strong className="text-white">Espacio:</strong> Activar DRS</li>
            <li><strong className="text-white">C:</strong> Cambiar Cámara (Cockpit / Trasera)</li>
            <li><strong className="text-white">R:</strong> Reincorporar auto a pista</li>
          </ul>
        </div>
      )}

      {/* ============================================================ */}
      {/* BOTTOM AREA: ERGONOMIC LAYOUT REQUESTED BY USER */}
      {/* LEFT: Volante / Botones Dirección */}
      {/* CENTER: Velocímetro, Tacómetro, Cronómetro, Acelerómetro */}
      {/* RIGHT: Freno (Izq) y Acelerador (Der) juntos */}
      {/* ============================================================ */}
      <footer className="w-full flex items-end justify-between pointer-events-none gap-2 sm:gap-4 mt-auto">
        {/* ------------------------------------------------------------ */}
        {/* LADO IZQUIERDO: VOLANTE TÁCTIL (Donde antes estaba el freno) */}
        {/* ------------------------------------------------------------ */}
        <div className="pointer-events-auto flex flex-col items-center">
          {controlMode === 'touch' ? (
            <div
              ref={wheelRef}
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                triggerHaptic(15);
                handleWheelStart(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (isDraggingWheel.current) {
                  updateWheelAngle(e.clientX, e.clientY);
                }
              }}
              onPointerUp={(e) => {
                try {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore
                }
                handleWheelEnd();
              }}
              onPointerCancel={handleWheelEnd}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white/25 bg-black/75 backdrop-blur-md flex items-center justify-center shadow-2xl cursor-grab active:cursor-grabbing select-none touch-none"
              style={{
                transform: `rotate(${steeringTouchAngle}deg)`,
                transition: isDraggingWheel.current ? 'none' : 'transform 0.15s ease-out',
              }}
              aria-label="Volante de dirección táctil"
            >
              {/* Rim Details */}
              <div className="absolute inset-1.5 rounded-full border border-white/10" />
              {/* Top Red Center Strip */}
              <div className="absolute top-0 w-3 h-4 bg-[#FF1801] rounded-b-sm shadow" />
              {/* Horizontal Spoke */}
              <div className="absolute w-full h-3.5 bg-white/20" />
              {/* Vertical Spoke */}
              <div className="absolute h-full w-3.5 bg-white/20" />
              {/* Hub Cap with F1 */}
              <div className="w-10 h-10 rounded-full bg-[#181818] border-2 border-[#FFD700] flex items-center justify-center z-10 shadow-lg">
                <span className="font-racing font-black text-xs text-white">F1</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-black/60 px-3 py-2 rounded-xl border border-white/10 text-xs font-racing text-white/80">
              <Compass className="w-4 h-4 text-[#FF1801]" />
              <span>Giroscopio</span>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* CENTRO INFERIOR: VELOCIDAD, ACELERÓMETRO Y CRONÓMETRO */}
        {/* ------------------------------------------------------------ */}
        <div className="pointer-events-auto flex-1 max-w-sm sm:max-w-md flex flex-col items-center">
          {/* RPM LED Bar */}
          <div
            className={`flex items-center justify-center gap-0.5 sm:gap-1 px-3 py-1 bg-black/90 rounded-t-xl border-t border-x border-white/20 backdrop-blur-md shadow-lg ${
              isRedlineFlashing ? 'animate-pulse' : ''
            }`}
          >
            {Array.from({ length: 15 }).map((_, i) => {
              const isLit = i < activeLedsCount;
              let ledColorClass = 'bg-white/10';
              if (isLit) {
                if (i < 5) ledColorClass = 'bg-emerald-400 shadow-[0_0_6px_#34d399]';
                else if (i < 10) ledColorClass = 'bg-red-500 shadow-[0_0_6px_#ef4444]';
                else ledColorClass = 'bg-purple-400 shadow-[0_0_8px_#c084fc]';
              }
              return <div key={i} className={`w-2.5 sm:w-3.5 h-2 rounded-xs transition-all duration-75 ${ledColorClass}`} />;
            })}
          </div>

          {/* Instrument Cluster Box */}
          <div className="w-full bg-black/85 border border-white/20 rounded-b-xl px-2.5 py-2 backdrop-blur-md shadow-2xl flex items-center justify-between">
            {/* Lap Time & Best */}
            <div className="flex flex-col text-left">
              <span className="text-[9px] uppercase font-racing text-white/50 tracking-wider">
                {drivingMode === 'time_attack' ? 'CRONÓMETRO' : 'VUELTA'}
              </span>
              <span className="font-racing font-black text-sm sm:text-base text-[#FFD700] tracking-tight">
                {formatTime(telemetry.lapTime)}
              </span>
              <span className="text-[9px] text-white/50 font-racing">
                MEJOR: <strong className="text-white">{formatTime(telemetry.bestLapTime)}</strong>
              </span>
            </div>

            {/* Central Gear & Speed */}
            <div className="flex items-center gap-2">
              {/* Gear */}
              <div className="flex flex-col items-center justify-center w-8 h-10 sm:w-10 sm:h-12 bg-white/5 border border-white/15 rounded-lg">
                <span className="text-[8px] font-racing text-white/40">MARCHA</span>
                <span className="font-racing font-black text-lg sm:text-2xl text-white">
                  {telemetry.gear === 0 ? 'R' : telemetry.speedKmh < 2 ? 'N' : telemetry.gear}
                </span>
              </div>

              {/* Speed */}
              <div className="flex flex-col items-center">
                <div className="flex items-baseline">
                  <span className="font-racing font-black text-2xl sm:text-4xl text-white tracking-tighter">
                    {telemetry.speedKmh}
                  </span>
                  <span className="font-racing font-bold text-[10px] text-[#FF1801] ml-0.5">KM/H</span>
                </div>
                <span className="text-[8px] text-white/40 font-racing">
                  {telemetry.rpm} RPM
                </span>
              </div>
            </div>

            {/* DRS & Throttle/Brake G-Forces */}
            <div className="flex flex-col items-end gap-1">
              {/* DRS */}
              <button
                onClick={() => {
                  triggerHaptic(20);
                  onToggleDRS();
                }}
                disabled={!telemetry.drsAvailable}
                className={`px-2 py-0.5 rounded text-[10px] font-racing font-bold uppercase transition border ${
                  telemetry.drsActive
                    ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_8px_#10b981]'
                    : telemetry.drsAvailable
                    ? 'bg-white/10 border-emerald-400 text-emerald-400'
                    : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                DRS {telemetry.drsActive ? 'ON' : telemetry.drsAvailable ? 'DISP' : 'OFF'}
              </button>

              {/* Throttle & Brake indicators */}
              <div className="flex items-center gap-1">
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-racing text-red-400">BRK</span>
                  <div className="w-2 h-6 bg-white/10 rounded-xs overflow-hidden flex flex-col justify-end">
                    <div
                      className="bg-red-500 w-full"
                      style={{ height: `${telemetry.brake * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-racing text-emerald-400">THR</span>
                  <div className="w-2 h-6 bg-white/10 rounded-xs overflow-hidden flex flex-col justify-end">
                    <div
                      className="bg-emerald-400 w-full"
                      style={{ height: `${telemetry.throttle * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* LADO DERECHO: FRENO (Izq) y ACELERADOR (Der) JUNTOS         */}
        {/* ------------------------------------------------------------ */}
        <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
          {/* 1. PEDAL DE FRENO (A la izquierda del acelerador) */}
          <button
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              triggerHaptic(20);
              onBrakeChange(1.0);
            }}
            onPointerUp={(e) => {
              try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {
                // Ignore
              }
              onBrakeChange(0.0);
            }}
            onPointerCancel={() => onBrakeChange(0.0)}
            className="w-16 h-24 sm:w-20 sm:h-30 rounded-2xl bg-gradient-to-t from-red-950 to-red-800/85 active:from-red-600 active:to-red-500 border-2 border-red-500/60 shadow-2xl flex flex-col items-center justify-between p-2.5 select-none touch-none cursor-pointer transition active:scale-95"
            aria-label="Freno"
          >
            <span className="w-full h-1 bg-red-400 rounded-full opacity-60" />
            <div className="flex flex-col items-center">
              <span className="font-racing font-black text-xs sm:text-sm text-white tracking-wider uppercase">
                FRENO
              </span>
              <span className="text-[8px] text-white/60">BRAKE</span>
            </div>
            <span className="w-full h-1 bg-red-400 rounded-full opacity-60" />
          </button>

          {/* 2. PEDAL DE ACELERADOR (A la derecha del freno) */}
          <button
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              triggerHaptic(20);
              onThrottleChange(1.0);
            }}
            onPointerUp={(e) => {
              try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {
                // Ignore
              }
              onThrottleChange(0.0);
            }}
            onPointerCancel={() => onThrottleChange(0.0)}
            className="w-18 h-28 sm:w-22 sm:h-34 rounded-2xl bg-gradient-to-t from-emerald-950 to-emerald-800/85 active:from-emerald-500 active:to-emerald-400 border-2 border-emerald-500/60 shadow-2xl flex flex-col items-center justify-between p-2.5 select-none touch-none cursor-pointer transition active:scale-95"
            aria-label="Acelerador"
          >
            <span className="w-full h-1 bg-emerald-400 rounded-full opacity-60" />
            <div className="flex flex-col items-center">
              <span className="font-racing font-black text-sm sm:text-base text-white tracking-wider uppercase">
                GAS
              </span>
              <span className="text-[8px] text-white/60">ACELERAR</span>
            </div>
            <span className="w-full h-1 bg-emerald-400 rounded-full opacity-60" />
          </button>
        </div>
      </footer>
    </div>
  );
};
