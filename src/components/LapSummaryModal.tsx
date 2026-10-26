import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Sparkles, Zap, Flag } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

interface LapSummaryModalProps {
  isOpen: boolean;
  lapTime: number;
  bestLapTime: number | null;
  isNewRecord: boolean;
  topSpeed: number;
  carName: string;
  circuitName: string;
  onRetry: () => void;
  onBackToMenu: () => void;
}

export const LapSummaryModal: React.FC<LapSummaryModalProps> = ({
  isOpen,
  lapTime,
  bestLapTime,
  isNewRecord,
  topSpeed,
  carName,
  circuitName,
  onRetry,
  onBackToMenu,
}) => {
  useEffect(() => {
    if (isOpen && isNewRecord) {
      // Fire festive racing confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF1801', '#FFD700', '#FFFFFF', '#00A19B'],
      });
      triggerHaptic([60, 40, 80, 40, 120]);
    }
  }, [isOpen, isNewRecord]);

  if (!isOpen) return null;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Top Trophy / Flag Icon */}
        <div className="relative mb-3">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isNewRecord ? 'bg-[#FFD700]/20 text-[#FFD700] ring-4 ring-[#FFD700]/40' : 'bg-[#FF1801]/20 text-[#FF1801]'
            }`}
          >
            {isNewRecord ? <Trophy className="w-8 h-8" /> : <Flag className="w-8 h-8" />}
          </div>
        </div>

        {/* Title */}
        <span className="font-racing text-xs tracking-widest text-[#FF1801] uppercase font-bold mb-1">
          {isNewRecord ? '¡NUEVO RÉCORD DE VUELTA!' : 'VUELTA COMPLETADA'}
        </span>
        <h2 className="text-2xl font-racing font-bold text-white uppercase mb-1">
          BANDERA A CUADROS
        </h2>
        <p className="text-xs text-white/60 mb-5">
          {circuitName} • {carName}
        </p>

        {/* Time Card */}
        <div className="w-full bg-[#121212] border border-white/10 rounded-xl p-4 mb-4">
          <span className="text-[11px] font-racing text-white/50 uppercase tracking-widest">
            Tiempo de Vuelta
          </span>
          <div className="font-racing font-black text-4xl text-[#FFD700] my-1 tracking-tight">
            {formatTime(lapTime)}
          </div>
          {bestLapTime && (
            <div className="text-xs text-white/70 font-racing">
              Mejor Personal: <span className="text-white font-bold">{formatTime(bestLapTime)}</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 w-full mb-6">
          <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col items-center">
            <span className="text-[10px] text-white/50 uppercase font-racing">Velocidad Máxima</span>
            <span className="font-racing font-bold text-base text-white">{topSpeed} km/h</span>
          </div>

          <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col items-center">
            <span className="text-[10px] text-white/50 uppercase font-racing">Estado</span>
            <span className="font-racing font-bold text-base text-emerald-400">Válida</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            onClick={() => {
              triggerHaptic(20);
              onRetry();
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF1801] hover:bg-[#d41400] text-white font-racing font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-[#FF1801]/30 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Otra Vuelta</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              onBackToMenu();
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-racing font-medium text-xs uppercase tracking-wider transition border border-white/10 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Menú Principal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
