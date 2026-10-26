import React from 'react';
import { RaceParticipant } from '../types/game';
import { Trophy, Flag, RotateCcw, LogOut, Medal } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

interface RaceFinishModalProps {
  isOpen: boolean;
  playerPos: number;
  leaderboard: RaceParticipant[];
  circuitName: string;
  totalLaps: number;
  onRestart: () => void;
  onExit: () => void;
}

export const RaceFinishModal: React.FC<RaceFinishModalProps> = ({
  isOpen,
  playerPos,
  leaderboard,
  circuitName,
  totalLaps,
  onRestart,
  onExit,
}) => {
  if (!isOpen) return null;

  const isWinner = playerPos === 1;
  const isPodium = playerPos <= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-[#121214] border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl text-white overflow-hidden text-center">
        {/* Glow */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-48 rounded-full blur-3xl pointer-events-none ${
            isWinner
              ? 'bg-[#FFD700]/25'
              : isPodium
              ? 'bg-[#FF1801]/25'
              : 'bg-blue-600/20'
          }`}
        />

        {/* Chequered Flag Banner */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <Flag className="w-5 h-5 text-white animate-pulse" />
          <span className="font-racing text-xs font-bold uppercase tracking-widest text-white/70">
            Bandera a Cuadros • {circuitName.split(' (')[0]}
          </span>
        </div>

        {/* Trophy / Position Badge */}
        <div className="my-3 flex flex-col items-center">
          <div
            className={`w-20 h-20 rounded-3xl border flex items-center justify-center shadow-2xl mb-2 ${
              isWinner
                ? 'bg-gradient-to-tr from-amber-600 to-yellow-400 border-yellow-300 shadow-yellow-500/40'
                : isPodium
                ? 'bg-gradient-to-tr from-[#990000] to-[#FF1801] border-red-400 shadow-red-500/40'
                : 'bg-white/10 border-white/20'
            }`}
          >
            {isWinner ? (
              <Trophy className="w-10 h-10 text-black fill-current animate-bounce" />
            ) : (
              <Medal className="w-10 h-10 text-white" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-racing font-black uppercase tracking-wide">
            {isWinner
              ? '¡VICTORIA!'
              : isPodium
              ? '¡PODIO FINAL!'
              : 'CARRERA COMPLETADA'}
          </h2>
          <span className="text-xs text-white/60 font-racing mt-0.5">
            Posición Final: <strong className="text-[#FFD700] text-sm">P{playerPos}</strong> de 5 pilotos • {totalLaps} vueltas
          </span>
        </div>

        {/* Final Classification Table */}
        <div className="my-4 bg-black/50 border border-white/10 rounded-2xl p-3 text-left">
          <span className="text-[10px] font-racing text-white/50 uppercase tracking-wider block mb-2 font-bold">
            Clasificación Oficial del Gran Premio
          </span>
          <div className="space-y-1.5">
            {leaderboard.map((item, idx) => {
              const isPlayerItem = item.isPlayer;
              return (
                <div
                  key={item.id}
                  className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs transition border ${
                    isPlayerItem
                      ? 'bg-[#FF1801]/30 border-[#FF1801] font-bold text-white shadow-md'
                      : 'bg-white/5 border-transparent text-white/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`font-racing font-black text-xs w-5 text-center ${
                        idx === 0
                          ? 'text-[#FFD700]'
                          : idx === 1
                          ? 'text-slate-300'
                          : idx === 2
                          ? 'text-amber-500'
                          : 'text-white/40'
                      }`}
                    >
                      P{idx + 1}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="truncate">
                      <span className="font-racing block truncate">
                        {item.name} {isPlayerItem && '(Tú)'}
                      </span>
                      <span className="text-[10px] text-white/40 block leading-none truncate">
                        {item.team}
                      </span>
                    </div>
                  </div>

                  <span className="font-racing font-mono text-[11px] text-white/70 shrink-0">
                    {item.gapToLeader}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            onClick={() => {
              triggerHaptic(20);
              onRestart();
            }}
            className="py-3 px-4 rounded-xl bg-[#FF1801] hover:bg-[#e01600] text-white font-racing font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF1801]/30 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Correr Otra</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic(15);
              onExit();
            }}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-racing font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Menú</span>
          </button>
        </div>
      </div>
    </div>
  );
};
