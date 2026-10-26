import React from 'react';
import { X, Cpu, Info, Shield, CheckCircle2 } from 'lucide-react';
import { triggerHaptic } from '../audio/engineSound';

interface InspectPartModalProps {
  partInfo: {
    name: string;
    specs: string;
    description: string;
  } | null;
  onClose: () => void;
}

export const InspectPartModal: React.FC<InspectPartModalProps> = ({ partInfo, onClose }) => {
  if (!partInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#181818] border border-white/15 rounded-2xl p-5 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#FF1801]/20 border border-[#FF1801]/40 flex items-center justify-center text-[#FF1801]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <span className="font-racing text-[10px] tracking-widest text-[#FF1801] uppercase font-bold block">
              Inspección de Ingeniería F1 (Raycaster)
            </span>
            <h3 className="font-racing font-bold text-lg text-white leading-tight">
              {partInfo.name}
            </h3>
          </div>
        </div>

        {/* Specs tag */}
        {partInfo.specs && (
          <div className="inline-block bg-white/5 border border-white/10 px-2.5 py-1 rounded text-xs font-racing text-[#FFD700] mb-3">
            {partInfo.specs}
          </div>
        )}

        {/* Description */}
        <p className="text-xs text-white/80 leading-relaxed mb-4">
          {partInfo.description}
        </p>

        {/* Footer */}
        <button
          onClick={() => {
            triggerHaptic(15);
            onClose();
          }}
          className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-racing text-xs uppercase tracking-wider transition border border-white/10"
        >
          Cerrar Inspección
        </button>
      </div>
    </div>
  );
};
