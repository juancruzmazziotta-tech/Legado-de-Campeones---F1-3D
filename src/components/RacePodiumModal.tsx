import React from 'react';
import { RaceStanding } from '../types/game';
import { Trophy, Medal, RotateCcw, LogOut, Flag } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

interface RacePodiumModalProps {
  isOpen: boolean;
  standings: RaceStanding[];
  playerFinalPosition: number;
  circuitName: string;
  onRestart: () => void;
  onExit: () => void;
}

export const RacePodiumModal: React.FC<RacePodiumModalProps> = ({
  isOpen,
  standings,
  playerFinalPosition,
  circuitName,
  onRestart,
  onExit,
}) => {
  if (!isOpen) return null;

  const isWin = playerFinalPosition === 1;
  const isPodium = playerFinalPosition <= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#141416] border border-white/20 rounded-3xl p-5 shadow-2xl text-white flex flex-col max-h-[90vh]">
        {/* Top Header Badge */}
        <div className="text-center pb-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-yellow-500/20 to-amber-500/40 border border-amber-400/50 mb-2 shadow-lg shadow-amber-500/20">
            {isWin ? (
              <Trophy className="w-10 h-10 text-[#FFD700] animate-bounce" />
            ) : isPodium ? (
              <Medal className="w-10 h-10 text-emerald-400" />
            ) : (
              <Flag className="w-10 h-10 text-[#FF1801]" />
            )}
          </div>

          <h2 className="font-racing font-black text-2xl sm:text-3xl uppercase tracking-wider text-white">
            {isWin
              ? '¡VICTORIA! 🏆'
              : isPodium
              ? `¡PODIO! P${playerFinalPosition} 🏁`
              : `CARRERA COMPLETADA - P${playerFinalPosition}`}
          </h2>

          <p className="text-xs text-white/70 mt-0.5">
            Gran Premio de {circuitName.split(' (')[0]} • Clasificación Final
          </p>
        </div>

        {/* 5-Car Classification Table */}
        <div className="my-3 space-y-2 overflow-y-auto flex-1 pr-1">
          {standings.map((car, idx) => {
            const pos = idx + 1;
            const isPlayer = car.isPlayer;

            let posBadgeColor = 'bg-white/10 text-white/70';
            if (pos === 1) posBadgeColor = 'bg-[#FFD700] text-black font-black';
            else if (pos === 2) posBadgeColor = 'bg-slate-300 text-black font-bold';
            else if (pos === 3) posBadgeColor = 'bg-amber-600 text-white font-bold';

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                  isPlayer
                    ? 'bg-[#FF1801]/20 border-[#FF1801] shadow-lg shadow-[#FF1801]/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-racing text-xs ${posBadgeColor}`}
                  >
                    P{pos}
                  </span>

                  <div
                    className="w-2.5 h-7 rounded-full shrink-0"
                    style={{ backgroundColor: car.teamColor }}
                  />

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-racing font-bold text-sm text-white">
                        {car.driver}
                      </span>
                      {isPlayer && (
                        <span className="text-[9px] bg-[#FF1801] text-white font-racing font-bold px-1.5 py-0.2 rounded uppercase">
                          TÚ
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/50 block">
                      {car.team}
                    </span>
                  </div>
                </div>

                <div className="text-right font-racing">
                  <span className="text-xs font-bold text-white/80 block">
                    {pos === 1 ? 'GANADOR' : car.gap || `+${(pos * 1.8).toFixed(1)}s`}
                  </span>
                  <span className="text-[10px] text-white/40">3 Vueltas</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 flex gap-2">
          <button
            onClick={() => {
              triggerHaptic(20);
              onRestart();
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF1801] to-[#b31000] text-white font-racing font-bold text-xs sm:text-sm uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#FF1801]/30"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Correr de Nuevo</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(20);
              onExit();
            }}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-racing font-bold text-xs sm:text-sm uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4 text-white/70" />
            <span>Menú</span>
          </button>
        </div>
      </div>
    </div>
  );
};
