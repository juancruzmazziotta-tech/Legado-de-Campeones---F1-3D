import React from 'react';
import { LapRecordItem } from '../types/game';
import { Timer, Trophy, X, RotateCcw } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

interface LapHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  circuitName: string;
  lapHistory: LapRecordItem[];
  bestLapTime: number | null;
}

export const LapHistoryModal: React.FC<LapHistoryModalProps> = ({
  isOpen,
  onClose,
  circuitName,
  lapHistory,
  bestLapTime,
}) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatDelta = (lapTime: number, best: number | null): string => {
    if (best === null || lapTime <= best) return 'RÉCORD';
    const diff = lapTime - best;
    return `+${diff.toFixed(3)}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#141416] border border-white/15 rounded-3xl p-5 shadow-2xl text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FF1801]/20 border border-[#FF1801]/40 flex items-center justify-center">
              <Timer className="w-5 h-5 text-[#FF1801]" />
            </div>
            <div>
              <h3 className="font-racing font-black text-lg text-white uppercase tracking-wider">
                Historial de Tiempos
              </h3>
              <p className="text-xs text-white/60">
                {circuitName.split(' (')[0]} • {lapHistory.length} vueltas registradas
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic(15);
              onClose();
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Best Lap Highlight Banner */}
        {bestLapTime && (
          <div className="my-3 p-3 rounded-2xl bg-gradient-to-r from-purple-900/40 via-purple-600/20 to-transparent border border-purple-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-400" />
              <span className="font-racing font-bold text-xs uppercase text-purple-200">
                Mejor Vuelta Sesión
              </span>
            </div>
            <span className="font-racing font-black text-base text-purple-300">
              {formatTime(bestLapTime)}
            </span>
          </div>
        )}

        {/* Laps List */}
        <div className="flex-1 overflow-y-auto pr-1 my-2 space-y-2">
          {lapHistory.length === 0 ? (
            <div className="py-8 text-center text-white/50 text-xs">
              <p>Aún no has completado ninguna vuelta en esta sesión.</p>
              <p className="mt-1 text-[11px] text-white/40">
                Cruza la línea de meta para registrar tus tiempos.
              </p>
            </div>
          ) : (
            lapHistory.map((item, idx) => {
              const delta = formatDelta(item.time, bestLapTime);
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl border transition ${
                    item.isBest
                      ? 'bg-purple-950/30 border-purple-500/50 text-purple-200'
                      : 'bg-white/5 border-white/10 text-white/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center font-racing font-bold text-xs text-white/60">
                      V{item.lapNumber}
                    </span>
                    <span className="font-racing font-bold text-sm text-white">
                      {formatTime(item.time)}
                    </span>
                  </div>

                  <span
                    className={`font-racing text-xs font-bold px-2 py-0.5 rounded-full ${
                      item.isBest
                        ? 'bg-purple-500 text-black font-extrabold'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {delta}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10">
          <button
            onClick={() => {
              triggerHaptic(20);
              onClose();
            }}
            className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-racing font-bold text-sm uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Volver a la Pista</span>
          </button>
        </div>
      </div>
    </div>
  );
};
