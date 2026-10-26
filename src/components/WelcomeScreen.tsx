import React, { useState } from 'react';
import { Compass, Mic, Camera, QrCode, Play, Volume2, ShieldCheck, Flag } from 'lucide-react';
import { audioManager, triggerHaptic } from '../audio/engineSound';

interface WelcomeScreenProps {
  onStart: () => void;
  onOpenQR: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onOpenQR }) => {
  const [requestingSensors, setRequestingSensors] = useState<boolean>(false);
  const [sensorsGranted, setSensorsGranted] = useState<{ gyro: boolean; mic: boolean }>({
    gyro: false,
    mic: false,
  });

  const handleStartExperience = async () => {
    triggerHaptic([30, 20]);
    setRequestingSensors(true);

    // 1. Initialize Web Audio Context on this mandatory user interaction
    await audioManager.initAudio();

    // 2. Request DeviceOrientation permission (Required for iOS 13+)
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (permission === 'granted') {
          setSensorsGranted((prev) => ({ ...prev, gyro: true }));
        }
      } catch (err) {
        console.warn('DeviceOrientation permission request error:', err);
      }
    } else {
      // Android / Chrome desktop permissions auto-granted
      setSensorsGranted((prev) => ({ ...prev, gyro: true }));
    }

    setRequestingSensors(false);
    onStart();
  };

  return (
    <div className="relative w-full min-h-screen bg-[#121212] bg-carbon flex flex-col justify-between items-center p-6 text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#FF1801]/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-[#FFD700]/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Badge */}
      <header className="w-full max-w-md flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FF1801] rounded-sm rotate-45 animate-pulse"></div>
          <span className="font-racing text-xs tracking-widest text-[#FF1801] uppercase font-bold">
            F1 Experiencia Web 3D
          </span>
        </div>
        <button
          onClick={() => {
            triggerHaptic(15);
            onOpenQR();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white/90 font-medium transition"
        >
          <QrCode className="w-3.5 h-3.5 text-[#FFD700]" />
          <span>Acceso QR</span>
        </button>
      </header>

      {/* Hero Visual & Title */}
      <main className="w-full max-w-md flex flex-col items-center text-center my-auto py-6 z-10">
        {/* F1 Visual Badge */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-[#1a1a1a] to-[#2a2a2a] border border-[#FF1801]/40 flex items-center justify-center shadow-xl shadow-[#FF1801]/20">
            <Flag className="w-12 h-12 text-[#FF1801]" />
          </div>
          <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-[#FFD700] text-black font-racing font-extrabold text-[10px] tracking-wider uppercase shadow">
            Mobile 3D
          </div>
        </div>

        {/* Title */}
        <h1 className="font-racing text-4xl sm:text-5xl font-black tracking-tight leading-none uppercase mb-2">
          LEGADO DE <br />
          <span className="bg-gradient-to-r from-[#FF1801] via-[#FF5500] to-[#FFD700] bg-clip-text text-transparent">
            CAMPEONES
          </span>
        </h1>

        <p className="font-body text-sm sm:text-base text-white/70 max-w-xs mb-6">
          Simulador interactivo de Fórmula 1 en Three.js optimizado para smartphones con control por sensores y vista de piloto.
        </p>

        {/* Sensor & Feature Highlights Card */}
        <div className="w-full bg-black/60 border border-white/10 rounded-xl p-4 mb-6 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3 text-left">
            <ShieldCheck className="w-4 h-4 text-[#FFD700]" />
            <span className="font-racing text-xs text-white/80 font-bold uppercase tracking-wider">
              Capacidades Integradas
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col items-center">
              <Compass className="w-5 h-5 text-[#FF1801] mb-1" />
              <span className="text-[11px] font-bold text-white">Giroscopio</span>
              <span className="text-[9px] text-white/50">Inclinación 360°</span>
            </div>

            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col items-center">
              <Volume2 className="w-5 h-5 text-[#FFD700] mb-1" />
              <span className="text-[11px] font-bold text-white">Motor V6</span>
              <span className="text-[9px] text-white/50">Audio Sintético</span>
            </div>

            <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 flex flex-col items-center">
              <Camera className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Cockpit F1</span>
              <span className="text-[9px] text-white/50">Vista Piloto</span>
            </div>
          </div>
        </div>

        {/* Primary CTA: INICIAR EXPERIENCIA */}
        <button
          onClick={handleStartExperience}
          disabled={requestingSensors}
          className="group relative w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#FF1801] via-[#e01600] to-[#b31000] text-white font-racing font-extrabold text-lg uppercase tracking-wider shadow-xl shadow-[#FF1801]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 overflow-hidden cursor-pointer"
        >
          <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000"></div>
          <Play className="w-5 h-5 fill-current text-[#FFD700]" />
          <span>{requestingSensors ? 'CONFIGURANDO...' : 'INICIAR EXPERIENCIA'}</span>
        </button>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-md text-center text-[11px] text-white/40 pb-2 z-10 flex flex-col items-center gap-1">
        <span>Diseño y Programación Web II • Parcial 2</span>
        <span>Three.js WebGL • 60 FPS Mobile Architecture</span>
      </footer>
    </div>
  );
};
