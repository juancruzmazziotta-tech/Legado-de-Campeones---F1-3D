import React, { useState } from 'react';
import { CARS_DATA, CIRCUITS_DATA } from '../data/f1Data';
import { CarSpecs, CircuitId, ControlMode, CameraMode, DrivingMode } from '../types/game';
import { ArrowLeft, Play, Eye, Camera, Gauge, Zap } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

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
  const [selectedControl, setSelectedControl] = useState<ControlMode>('touch');
  const [selectedDrivingMode, setSelectedDrivingMode] = useState<DrivingMode>('practice');

  const handleStartDriving = () => {
    triggerHaptic([40, 20]);
    onConfirm({
      car: selectedCar,
      circuit: selectedCircuit,
      control: selectedControl,
      camera: selectedCamera,
      drivingMode: selectedDrivingMode,
    });
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#0e0e10] bg-carbon flex flex-col justify-between text-white overflow-hidden select-none">
      {/* Top Header */}
      <header className="w-full max-w-2xl mx-auto px-4 pt-5 pb-2 flex items-center justify-between z-10">
        <button
          onClick={() => {
            triggerHaptic(15);
            onBack();
          }}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 transition"
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
      </header>

      {/* Main Single-Screen Content */}
      <main className="w-full max-w-2xl mx-auto flex-1 px-4 py-3 flex flex-col justify-center gap-4 overflow-y-auto z-10">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-racing font-extrabold uppercase tracking-wide">
            Preparado para la Pista
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            Monoplaza y circuito listos para salir a rodar
          </p>
        </div>

        {/* 1. Monoplaza Card */}
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

            {/* Quick Car Selector (if user wants to toggle between F1 2022 and F2004) */}
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

        {/* 2. Circuito Card */}
        {CIRCUITS_DATA.length > 0 && (
          <div className="bg-black/60 border border-white/15 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-racing font-bold text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#FF1801]" />
                Circuito
              </span>
              <span className="text-xs font-racing text-white/70 bg-white/10 px-2 py-0.5 rounded">
                {CIRCUITS_DATA.find((c) => c.id === selectedCircuit)?.country || 'Italia'}
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

        {/* 3. Camera View Quick Toggle */}
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
      </main>

      {/* Massive Primary CTA: EMPEZAR A MANEJAR */}
      <footer className="w-full max-w-2xl mx-auto p-4 z-10">
        <button
          onClick={handleStartDriving}
          className="group relative w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF1801] via-[#e51500] to-[#b31000] text-white font-racing font-black text-lg uppercase tracking-widest shadow-2xl shadow-[#FF1801]/40 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000" />
          <Play className="w-5 h-5 fill-current text-[#FFD700]" />
          <span>EMPEZAR A MANEJAR</span>
        </button>
      </footer>
    </div>
  );
};
