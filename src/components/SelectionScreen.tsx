import React, { useState } from 'react';
import { CARS_DATA, CIRCUITS_DATA } from '../data/f1Data';
import { CarSpecs, CircuitId, ControlMode, CameraMode, DrivingMode } from '../types/game';
import { ArrowLeft, Play, Eye, Camera, Gauge, Zap, Compass, Gamepad2, Flag, Timer } from 'lucide-react';
import { audioManager, triggerHaptic } from '../audio/engineSound';

interface SelectionScreenProps {
  onConfirm: (config: {
    car: CarSpecs;
    circuit: CircuitId;
    control: ControlMode;
    camera: CameraMode;
    drivingMode: DrivingMode;
  }) => void;
  onBack: () => void;
}

export const SelectionScreen: React.FC<SelectionScreenProps> = ({ onConfirm, onBack }) => {
  const [selectedCar, setSelectedCar] = useState<CarSpecs>(CARS_DATA[0]); // F1 2022
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitId>(CIRCUITS_DATA[0].id); // Imola
  const [selectedCamera, setSelectedCamera] = useState<CameraMode>('cockpit');
  // Detect if touch/mobile to default to gyro
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const [selectedControl, setSelectedControl] = useState<ControlMode>(isTouchDevice ? 'gyro' : 'touch');
  const [selectedDrivingMode, setSelectedDrivingMode] = useState<DrivingMode>('practice');
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const handleStartDriving = async () => {
    triggerHaptic([40, 20]);
    setIsStarting(true);

    // 1. Request DeviceOrientation permission on iOS 13+ (must happen on user click)
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      } catch (err) {
        console.warn('DeviceOrientation permission request error:', err);
      }
    }

    // 2. Initialize Web Audio Context
    await audioManager.initAudio();

    onConfirm({
      car: selectedCar,
      circuit: selectedCircuit,
      control: selectedControl,
      camera: selectedCamera,
      drivingMode: selectedDrivingMode,
    });
  };

  return (
    <div className="relative w-full min-h-screen bg-[#0e0e10] bg-carbon flex flex-col text-white pb-36">
      {/* Top Header */}
      <header className="sticky top-0 left-0 right-0 w-full bg-[#0e0e10]/90 backdrop-blur-md border-b border-white/10 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              triggerHaptic(15);
              onBack();
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 transition cursor-pointer"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#FF1801] rounded-full animate-pulse" />
            <span className="font-racing text-xs tracking-widest text-[#FF1801] uppercase font-bold">
              Configuración de Carrera
            </span>
          </div>

          <div className="w-9" />
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="w-full max-w-2xl mx-auto flex-1 px-4 py-4 flex flex-col gap-4 z-10 pb-32">
        {/* Title */}
        <div className="text-center pt-1">
          <h2 className="text-2xl sm:text-3xl font-racing font-extrabold uppercase tracking-wide">
            Preparado para la Pista
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            Configura tu monoplaza, circuito y modo de dirección antes de salir
          </p>
        </div>

        {/* 0. MODO DE JUEGO (PRÁCTICA LIBRE VS GRAN PREMIO CARRERA) */}
        <div className="bg-black/75 border border-[#FF1801]/40 rounded-2xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-racing font-bold text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
              <Flag className="w-4 h-4 text-[#FF1801]" />
              Modo de Juego
            </span>
            <span className="text-[10px] font-racing font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              2 Modalidades
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Modo 1: Práctica Libre (Solitario) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setSelectedDrivingMode('practice');
              }}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-left ${
                selectedDrivingMode === 'practice'
                  ? 'bg-[#FF1801]/25 border-[#FF1801] text-white ring-2 ring-[#FF1801]/60 shadow-lg shadow-[#FF1801]/20'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  selectedDrivingMode === 'practice' ? 'bg-[#FF1801] text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                <Timer className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-racing font-bold text-white block">
                  ⏱️ Práctica Libre (Solitario)
                </span>
                <p className="text-[11px] text-white/70 mt-1 leading-snug">
                  Gira vueltas ilimitadas para batir tu récord y consulta tu tabla de tiempos en tiempo real.
                </p>
              </div>
            </button>

            {/* Modo 2: Gran Premio (Carrera vs 4 Autos IA) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setSelectedDrivingMode('race');
              }}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-left ${
                selectedDrivingMode === 'race'
                  ? 'bg-[#FF1801]/25 border-[#FF1801] text-white ring-2 ring-[#FF1801]/60 shadow-lg shadow-[#FF1801]/20'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  selectedDrivingMode === 'race' ? 'bg-[#FF1801] text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                <Flag className="w-6 h-6 text-[#FFD700]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-racing font-bold text-white">
                    🏁 Gran Premio (vs 4 Autos IA)
                  </span>
                  <span className="text-[9px] bg-[#FFD700] text-black font-extrabold px-1.5 py-0.2 rounded uppercase">
                    3 Vueltas
                  </span>
                </div>
                <p className="text-[11px] text-white/70 mt-1 leading-snug">
                  Largada con semáforo (3s), 5 monoplazas con colisiones físicas reales y podio final.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 1. MODO DE CONTROL (GIROSCOPIO VS TÁCTIL) - PROMINENT FOR MOBILE USERS */}
        <div className="bg-black/75 border border-[#FF1801]/40 rounded-2xl p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF1801]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-racing font-bold text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#FF1801]" />
              Modo de Control / Dirección
            </span>
            <span className="text-[10px] font-racing font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Sensor Smartphone
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Gyroscope (Steering Wheel by phone rotation) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setSelectedControl('gyro');
              }}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-left relative ${
                selectedControl === 'gyro'
                  ? 'bg-[#FF1801]/25 border-[#FF1801] text-white ring-2 ring-[#FF1801]/60 shadow-lg shadow-[#FF1801]/20'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  selectedControl === 'gyro' ? 'bg-[#FF1801] text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                <Compass className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-racing font-bold text-white">
                    Giroscopio (Volante Móvil)
                  </span>
                  <span className="text-[9px] bg-[#FFD700] text-black font-extrabold px-1.5 py-0.2 rounded uppercase">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-white/70 mt-1 leading-snug">
                  Gira inclinando tu teléfono hacia los lados como un volante real de F1
                </p>
              </div>
            </button>

            {/* Virtual Touch Steering Wheel */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setSelectedControl('touch');
              }}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition cursor-pointer text-left ${
                selectedControl === 'touch'
                  ? 'bg-[#FF1801]/25 border-[#FF1801] text-white ring-2 ring-[#FF1801]/60 shadow-lg shadow-[#FF1801]/20'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  selectedControl === 'touch' ? 'bg-[#FF1801] text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs sm:text-sm font-racing font-bold text-white block">
                  Volante Táctil en Pantalla
                </span>
                <p className="text-[11px] text-white/70 mt-1 leading-snug">
                  Controla la dirección usando el volante virtual analógico en pantalla
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Monoplaza Card */}
        <div className="bg-black/60 border border-white/15 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-racing font-bold text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#FF1801]" />
              Monoplaza Seleccionado
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#FF1801] text-white uppercase">
              {selectedCar.era}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-racing font-black text-white">{selectedCar.name}</h3>
              <p className="text-xs text-white/70">{selectedCar.powerUnit}</p>
              <p className="text-[11px] text-white/50 mt-1">{selectedCar.description}</p>
            </div>

            {/* Quick Car Selector */}
            {CARS_DATA.length > 1 && (
              <div className="flex sm:flex-col gap-2 shrink-0">
                {CARS_DATA.map((car) => {
                  const isCur = selectedCar.id === car.id;
                  return (
                    <button
                      key={car.id}
                      onClick={() => {
                        triggerHaptic(20);
                        setSelectedCar(car);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-racing font-bold uppercase transition text-left cursor-pointer border ${
                        isCur
                          ? 'bg-[#FF1801] border-[#FF1801] text-white shadow-md shadow-[#FF1801]/30'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {car.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-white/60 mt-3 pt-3 border-t border-white/10">
            <span>Velocidad Punta: <strong className="text-white">{selectedCar.topSpeed} km/h</strong></span>
            <span>0-100 km/h: <strong className="text-[#FFD700]">{selectedCar.acceleration}s</strong></span>
          </div>
        </div>

        {/* 3. Circuito Card */}
        {CIRCUITS_DATA.length > 0 && (
          <div className="bg-black/60 border border-white/15 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-racing font-bold text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#FF1801]" />
                Circuito
              </span>
              <span className="text-xs font-racing text-white/70 bg-white/10 px-2 py-0.5 rounded">
                {CIRCUITS_DATA.find((c) => c.id === selectedCircuit)?.country || 'Bélgica'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-racing font-bold text-white">
                  {CIRCUITS_DATA.find((c) => c.id === selectedCircuit)?.name}
                </h3>
                <p className="text-xs text-white/70 mt-0.5">
                  {CIRCUITS_DATA.find((c) => c.id === selectedCircuit)?.description}
                </p>
              </div>

              {CIRCUITS_DATA.length > 1 && (
                <div className="flex sm:flex-col gap-2 shrink-0">
                  {CIRCUITS_DATA.map((circuit) => {
                    const isCur = selectedCircuit === circuit.id;
                    return (
                      <button
                        key={circuit.id}
                        onClick={() => {
                          triggerHaptic(20);
                          setSelectedCircuit(circuit.id);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-racing font-bold uppercase transition text-left cursor-pointer border ${
                          isCur
                            ? 'bg-[#FF1801] border-[#FF1801] text-white shadow-md shadow-[#FF1801]/30'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        {circuit.name.split(' (')[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {(() => {
              const cur = CIRCUITS_DATA.find((c) => c.id === selectedCircuit) || CIRCUITS_DATA[0];
              return (
                <div className="flex items-center gap-4 text-xs text-white/60 mt-3 pt-3 border-t border-white/10">
                  <span>Longitud: <strong className="text-white">{cur.length}</strong></span>
                  <span>Curvas: <strong className="text-white">{cur.corners}</strong></span>
                  <span>Récord: <strong className="text-[#FFD700]">{cur.lapRecord.split(' ')[0]}</strong></span>
                </div>
              );
            })()}
          </div>
        )}

        {/* 4. Camera View Quick Toggle */}
        <div className="bg-black/60 border border-white/15 rounded-2xl p-3.5 backdrop-blur-md">
          <span className="text-xs font-racing font-bold text-white/80 uppercase tracking-wider block mb-2">
            Vista de Cámara
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setSelectedCamera('cockpit');
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer ${
                selectedCamera === 'cockpit'
                  ? 'bg-[#FF1801]/25 border-[#FF1801] text-white font-bold ring-1 ring-[#FF1801]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-racing">Vista Piloto (Cockpit)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setSelectedCamera('chase');
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 transition cursor-pointer ${
                selectedCamera === 'chase'
                  ? 'bg-[#FF1801]/25 border-[#FF1801] text-white font-bold ring-1 ring-[#FF1801]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs font-racing">Vista Trasera (3ra Persona)</span>
            </button>
          </div>
        </div>
        {/* In-flow Start Button (right below cards) */}
        <div className="pt-2">
          <button
            onClick={handleStartDriving}
            disabled={isStarting}
            className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF1801] via-[#e51500] to-[#b31000] text-white font-racing font-black text-base sm:text-lg uppercase tracking-wider shadow-2xl shadow-[#FF1801]/40 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer overflow-hidden border border-[#FF1801]/50"
          >
            <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000" />
            <Play className="w-5 h-5 fill-current text-[#FFD700]" />
            <span>{isStarting ? 'INICIANDO SESIÓN...' : 'EMPEZAR A MANEJAR'}</span>
          </button>
        </div>
      </main>

      {/* Fixed Floating Bottom Bar: Always pinned to bottom of viewport on any device! */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-[#0e0e10]/95 backdrop-blur-xl border-t border-white/20 p-3 sm:p-4 z-50 shadow-2xl">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleStartDriving}
            disabled={isStarting}
            className="group relative w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF1801] via-[#e51500] to-[#b31000] text-white font-racing font-black text-base sm:text-lg uppercase tracking-wider shadow-2xl shadow-[#FF1801]/40 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer overflow-hidden border border-[#FF1801]/50"
          >
            <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000" />
            <Play className="w-5 h-5 fill-current text-[#FFD700]" />
            <span>{isStarting ? 'INICIANDO SESIÓN...' : 'EMPEZAR A MANEJAR'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
